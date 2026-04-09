import { executeInTransaction, transaction } from "../../config/db";

export class ReportService {
  // 
  // PROFIT LOSS REPORT START
  // 
  async getProfitLossReport(data: {
    level: "company" | "branch" | "firm";
    firm_id?: number;
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
  }) {

    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {

      /* ================= GET FIRM IDS ================= */

      let firmIds: number[] = [];

      if (level === "firm" && firm_id) {
        firmIds = [firm_id];
      }

      if (level === "branch" && branch_id) {
        const res = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = res.rows.map((r: any) => r.id);
      }

      if (level === "company" && company_id) {
        const res = await executeInTransaction(
          client,
          `
          SELECT f.id
          FROM firm f
          JOIN branches b ON b.id = f.branch_id
          WHERE b.company_id = $1
          `,
          [company_id]
        );
        firmIds = res.rows.map((r: any) => r.id);
      }

      if (!firmIds.length) {
        return this.emptyResponse();
      }

      /* ================= MAIN SUMMARY ================= */

      const overall = await this.getSummaryAndBreakdown(
        client,
        firmIds,
        level,
        { firm_id, branch_id, company_id },
        start_date,
        end_date
      );

      /* ================= LEVEL BASED ================= */

      if (level === "firm") return overall;

      if (level === "branch") {
        const firmWise = await this.getFirmWiseReport(
          client,
          firmIds,
          start_date,
          end_date
        );

        return {
          ...overall,
          firm_wise: firmWise
        };
      }

      if (level === "company") {
        const branchWise = await this.getBranchWiseReport(
          client,
          company_id!,
          start_date,
          end_date
        );

        return {
          ...overall,
          branch_wise: branchWise
        };
      }

    });
  }
  private buildDateFilter(
    column: string,
    startDate?: string,
    endDate?: string,
    startIndex: number = 2
  ) {
    if (!startDate || !endDate) {
      return {
        clause: ``,
        values: []
      };
    }

    return {
      clause: `AND ${column} BETWEEN $${startIndex} AND $${startIndex + 1}`,
      values: [startDate, endDate]
    };
  }
  private async getSummaryAndBreakdown(
    client: any,
    firmIds: number[],
    level: string,
    ids: any,
    startDate?: string,
    endDate?: string
  ) {

    /* ===== SALES ===== */
    const salesFilter = this.buildDateFilter("invoice_date", startDate, endDate);

    const sales = await executeInTransaction(client, `
      SELECT COALESCE(SUM(net_amount),0) AS total
      FROM sales
      WHERE firm_id = ANY($1)
      ${salesFilter.clause}
    `, [firmIds, ...salesFilter.values]);

    /* ===== PURCHASE RETURN ===== */
    const prFilter = this.buildDateFilter("return_date", startDate, endDate);

    const purchaseReturn = await executeInTransaction(client, `
      SELECT COALESCE(SUM(sub_total),0) AS total
      FROM purchase_return
      WHERE firm_id = ANY($1)
      ${prFilter.clause}
    `, [firmIds, ...prFilter.values]);

    /* ===== PURCHASES ===== */
    const purchaseFilter = this.buildDateFilter("bill_date", startDate, endDate);

    const purchases = await executeInTransaction(client, `
      SELECT COALESCE(SUM(net_amount),0) AS total
      FROM purchases
      WHERE firm_id = ANY($1)
      ${purchaseFilter.clause}
    `, [firmIds, ...purchaseFilter.values]);

    /* ===== SALES RETURN ===== */
    const srFilter = this.buildDateFilter("return_date", startDate, endDate);

    const saleReturn = await executeInTransaction(client, `
      SELECT COALESCE(SUM(sub_total),0) AS total
      FROM sale_return
      WHERE firm_id = ANY($1)
      ${srFilter.clause}
    `, [firmIds, ...srFilter.values]);

    /* ===== EXPENSES ===== */
    const expenseFilter = this.getLedgerFilter(level, ids);

    const expenseDateFilter = this.buildDateFilter(
      "lt.transaction_date",
      startDate,
      endDate,
      expenseFilter.startIndex
    );

    const expenses = await executeInTransaction(client, `
      SELECT 
        lc.name,
        SUM(lt.amount) AS amount
      FROM ledger_transactions lt
      JOIN ledger_categories lc ON lc.id = lt.category_id
      WHERE lc.category_type = 'E'
      AND ${expenseFilter.condition}
      ${expenseDateFilter.clause}
      GROUP BY lc.name
    `, [
      ...expenseFilter.values,
      ...expenseDateFilter.values
    ]);

    const totalExpense = expenses.rows.reduce(
      (a: number, b: any) => a + Number(b.amount),
      0
    );

    /* ===== CALCULATIONS ===== */

    const revenue =
      Number(sales.rows[0].total) +
      Number(purchaseReturn.rows[0].total);

    const cogs =
      Number(purchases.rows[0].total) +
      Number(saleReturn.rows[0].total);

    const gross_profit = revenue - cogs;
    const net_profit = gross_profit - totalExpense;

    /* ===== RESPONSE ===== */

    return {
      summary: {
        revenue,
        cogs,
        gross_profit,
        operating_expenses: totalExpense,
        net_profit
      },
      breakdown: {
        income_streams: [
          { description: "Sales", amount: Number(sales.rows[0].total) },
          { description: "Purchase Return", amount: Number(purchaseReturn.rows[0].total) }
        ],
        cost_of_goods: [
          { description: "Purchases", amount: Number(purchases.rows[0].total) },
          { description: "Sales Return", amount: Number(saleReturn.rows[0].total) }
        ],
        operating_expenses: expenses.rows.map((e: any) => ({
          category_name: e.name,
          amount: Number(e.amount)
        }))
      }
    };
  }
  private async getFirmWiseReport(
    client: any,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {

    const firms = await executeInTransaction(client, `
      SELECT id, firm_name FROM firm WHERE id = ANY($1)
    `, [firmIds]);

    const result = [];

    for (const f of firms.rows) {
      const data = await this.getSummaryAndBreakdown(
        client,
        [f.id],
        "firm",
        { firm_id: f.id },
        startDate,
        endDate
      );

      result.push({
        firm_id: f.id,
        firm_name: f.firm_name,
        ...data
      });
    }

    return result;
  }
  private async getBranchWiseReport(
    client: any,
    companyId: number,
    startDate?: string,
    endDate?: string
  ) {

    const branches = await executeInTransaction(client, `
      SELECT id, branch_name FROM branches WHERE company_id = $1
    `, [companyId]);

    const result = [];

    for (const b of branches.rows) {

      const firms = await executeInTransaction(client, `
        SELECT id FROM firm WHERE branch_id = $1
      `, [b.id]);

      const firmIds = firms.rows.map((f: any) => f.id);

      if (!firmIds.length) continue;

      const data = await this.getSummaryAndBreakdown(
        client,
        firmIds,
        "branch",
        { branch_id: b.id },
        startDate,
        endDate
      );

      result.push({
        branch_id: b.id,
        branch_name: b.branch_name,
        ...data
      });
    }

    return result;
  }
  private getLedgerFilter(level: string, ids: any) {

    if (level === "firm") {
      return {
        condition: `lt.entity_type = 'F' AND lt.entity_id = $1`,
        values: [ids.firm_id],
        startIndex: 2
      };
    }

    if (level === "branch") {
      return {
        condition: `lt.entity_type = 'B' AND lt.entity_id = $1`,
        values: [ids.branch_id],
        startIndex: 2
      };
    }

    return {
      condition: `lt.entity_type = 'C' AND lt.entity_id = $1`,
      values: [ids.company_id],
      startIndex: 2
    };
  }
  private emptyResponse() {
    return {
      summary: {
        revenue: 0,
        cogs: 0,
        gross_profit: 0,
        operating_expenses: 0,
        net_profit: 0
      },
      breakdown: {
        income_streams: [],
        cost_of_goods: [],
        operating_expenses: []
      }
    };
  }

  // 
  // PROFIT LOSS REPORT END 
  // 

  async getOutstandingReport(data: {
    level: "company" | "branch" | "firm";
    firm_id?: number;
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
  }) {

    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {

      /* ================= GET FIRM IDS ================= */

      let firmIds: number[] = [];

      if (level === "firm" && firm_id) {
        firmIds = [firm_id];
      }

      if (level === "branch" && branch_id) {
        const res = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = res.rows.map((r: any) => r.id);
      }

      if (level === "company" && company_id) {
        const res = await executeInTransaction(
          client,
          `
          SELECT f.id
          FROM firm f
          JOIN branches b ON b.id = f.branch_id
          WHERE b.company_id = $1
          `,
          [company_id]
        );
        firmIds = res.rows.map((r: any) => r.id);
      }

      if (!firmIds.length) {
        return this.emptyResponse();
      }

      /* ================= MAIN ================= */

      const overall = await this.getData(
        client,
        firmIds,
        start_date,
        end_date
      );

      /* ================= LEVEL BASED ================= */

      if (level === "firm") return overall;

      if (level === "branch") {
        const firmWise = await this.getFirmWiseReport(
          client,
          firmIds,
          start_date,
          end_date
        );

        return { ...overall, firm_wise: firmWise };
      }

      if (level === "company") {
        const branchWise = await this.getBranchWiseReport(
          client,
          company_id!,
          start_date,
          end_date
        );

        return { ...overall, branch_wise: branchWise };
      }

    });
  }

  /* ================= CORE ================= */

  private async getData(
    client: any,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {

 const dateFilter = this.buildDateFilter(
  "pb_date_placeholder", // will NOT be used directly
  startDate,
  endDate
);

    const result = await executeInTransaction(client, `
      SELECT 
        pb.ref_type,

        /* PARTY NAME */
        CASE 
          WHEN pb.ref_type = 'S' THEN c.customer_name
          WHEN pb.ref_type = 'P' THEN v.vendor_name
        END AS party_name,

        /* DOCUMENT NUMBER */
        CASE 
          WHEN pb.ref_type = 'S' THEN s.invoice_number
          WHEN pb.ref_type = 'P' THEN p.bill_number
        END AS doc_number,

        /* DOCUMENT DATE */
        CASE 
          WHEN pb.ref_type = 'S' THEN s.invoice_date
          WHEN pb.ref_type = 'P' THEN p.bill_date
        END AS doc_date,

        /* TOTAL */
        CASE 
          WHEN pb.ref_type = 'S' THEN s.final_amount
          WHEN pb.ref_type = 'P' THEN p.final_amount
        END AS total_amount,

        pb.balance AS pending_amount,

        /* AGING DAYS */
        CASE 
          WHEN pb.ref_type = 'S' THEN (CURRENT_DATE - s.invoice_date)
          WHEN pb.ref_type = 'P' THEN (CURRENT_DATE - p.bill_date)
        END AS aging_days,

        /* AGING BUCKET */
        CASE
          WHEN (
            CASE 
              WHEN pb.ref_type = 'S' THEN (CURRENT_DATE - s.invoice_date)
              WHEN pb.ref_type = 'P' THEN (CURRENT_DATE - p.bill_date)
            END
          ) BETWEEN 0 AND 30 THEN '0-30'

          WHEN (
            CASE 
              WHEN pb.ref_type = 'S' THEN (CURRENT_DATE - s.invoice_date)
              WHEN pb.ref_type = 'P' THEN (CURRENT_DATE - p.bill_date)
            END
          ) BETWEEN 31 AND 60 THEN '31-60'

          WHEN (
            CASE 
              WHEN pb.ref_type = 'S' THEN (CURRENT_DATE - s.invoice_date)
              WHEN pb.ref_type = 'P' THEN (CURRENT_DATE - p.bill_date)
            END
          ) BETWEEN 61 AND 90 THEN '61-90'

          ELSE '90+'
        END AS aging_bucket

      FROM party_balance pb

      LEFT JOIN sales s 
        ON pb.ref_id = s.id AND pb.ref_type = 'S'

      LEFT JOIN customers c 
        ON c.id = s.customer_id

      LEFT JOIN purchases p 
        ON pb.ref_id = p.id AND pb.ref_type = 'P'

      LEFT JOIN vendors v 
        ON v.id = p.vendor_id

      WHERE pb.flow = 'I'
      AND pb.balance > 0

      AND (
        (pb.ref_type = 'S' AND s.firm_id = ANY($1))
        OR
        (pb.ref_type = 'P' AND p.firm_id = ANY($1))
      )

      ${dateFilter.clause}
    `, [firmIds, ...dateFilter.values]);

    /* ================= FORMAT ================= */

    const map: any = {};

    let total_outstanding = 0;
    let bucket_0_30 = 0;
    let bucket_31_60 = 0;
    let bucket_61_90 = 0;
    let bucket_90_plus = 0;

    for (const row of result.rows) {

      const pending = Number(row.pending_amount);
      total_outstanding += pending;

      switch (row.aging_bucket) {
        case "0-30": bucket_0_30 += pending; break;
        case "31-60": bucket_31_60 += pending; break;
        case "61-90": bucket_61_90 += pending; break;
        default: bucket_90_plus += pending;
      }

      const key = `${row.ref_type}_${row.party_name}`;

      if (!map[key]) {
        map[key] = {
          party_type: row.ref_type === "S" ? "customer" : "vendor",
          party_name: row.party_name,
          total_outstanding: 0,
          documents: []
        };
      }

      map[key].total_outstanding += pending;

      map[key].documents.push({
        number: row.doc_number,
        date: row.doc_date,
        total: Number(row.total_amount),
        pending_amount: pending,
        aging_days: row.aging_days,
        aging_bucket: row.aging_bucket
      });
    }

    return {
      summary: {
        total_outstanding,
        bucket_0_30,
        bucket_31_60,
        bucket_61_90,
        bucket_90_plus
      },
      parties: Object.values(map)
    };
  }



}