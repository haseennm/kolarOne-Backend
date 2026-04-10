import { executeInTransaction, transaction } from "../../config/db";
import { cns } from "../../utils/extra";
import { GetGSTReportBody, GetReportBody } from "./report.types";

export class ReportService {
  // 
  // PROFIT LOSS REPORT START
  // 
  async getProfitLossReport(data: GetReportBody) {

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

  // 
  // START OUTSTANDING
  // 
  async getOutstandingReport(data: GetReportBody) {

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

  // 
  // END OUTSTANDING
  // 
  // private async getGSTSummarySalesOnly(
  //   client: any,
  //   firmIds: number[],
  //   startDate?: string,
  //   endDate?: string
  // ) {

  //   const hasDate = startDate && endDate;

  //   const result = await executeInTransaction(client, `
  //   SELECT
  //     SUM(total_cgst) AS cgst,
  //     SUM(total_sgst) AS sgst,
  //     SUM(total_igst) AS igst
  //   FROM (

  //     SELECT total_cgst, total_sgst, total_igst
  //     FROM sales
  //     WHERE status != 0 
  //     AND firm_id = ANY($1)
  //     ${hasDate ? `AND invoice_date BETWEEN $2 AND $3` : ``}

  //     UNION ALL

  //     SELECT -total_cgst, -total_sgst, -total_igst
  //     FROM sale_return
  //     WHERE status != 0 
  //     AND firm_id = ANY($1)
  //     ${hasDate ? `AND return_date BETWEEN $2 AND $3` : ``}

  //   ) t
  // `, hasDate ? [firmIds, startDate, endDate] : [firmIds]);

  //   const row = result.rows[0];

  //   const total_cgst = Number(row.cgst || 0);
  //   const total_sgst = Number(row.sgst || 0);
  //   const total_igst = Number(row.igst || 0);

  //   return {
  //     total_tax: total_cgst + total_sgst + total_igst,
  //     total_cgst,
  //     total_sgst,
  //     total_igst
  //   };
  // }
  // private async getFirmGSTSalesOnly(
  //   client: any,
  //   firmIds: number[],
  //   startDate?: string,
  //   endDate?: string
  // ) {

  //   const firms = await executeInTransaction(client, `
  //   SELECT id, firm_name, gstin
  //   FROM firm
  //   WHERE id = ANY($1)
  // `, [firmIds]);

  //   const result = [];

  //   for (const f of firms.rows) {

  //     const summary = await this.getGSTSummarySalesOnly(
  //       client,
  //       [f.id],
  //       startDate,
  //       endDate
  //     );

  //     const hasDate = startDate && endDate;

  //     const invoices = await executeInTransaction(client, `
  //     SELECT 
  //       'SALE' as type,
  //       invoice_number,
  //       invoice_date,
  //       net_amount AS taxable_value,
  //       total_cgst,
  //       total_sgst,
  //       total_igst
  //     FROM sales
  //     WHERE status != 0 
  //     AND firm_id = $1
  //     ${hasDate ? `AND invoice_date BETWEEN $2 AND $3` : ``}

  //     UNION ALL

  //     SELECT 
  //       'RETURN' as type,
  //       return_number,
  //       return_date,
  //       -sub_total,
  //       -total_cgst,
  //       -total_sgst,
  //       -total_igst
  //     FROM sale_return
  //     WHERE status != 0 
  //     AND firm_id = $1
  //     ${hasDate ? `AND return_date BETWEEN $2 AND $3` : ``}

  //     ORDER BY invoice_date
  //   `, hasDate ? [f.id, startDate, endDate] : [f.id]);

  //     result.push({
  //       firm_id: f.id,
  //       firm_name: f.firm_name,
  //       gstin: f.gstin,
  //       firm_tax_summary: {
  //         total_cgst: summary.total_cgst,
  //         total_sgst: summary.total_sgst,
  //         total_igst: summary.total_igst
  //       },
  //       invoices: invoices.rows.map((i: any) => ({
  //         type: i.type,
  //         invoice_number: i.invoice_number,
  //         invoice_date: i.invoice_date,
  //         taxable_value: Number(i.taxable_value),
  //         total_cgst: Number(i.total_cgst),
  //         total_sgst: Number(i.total_sgst),
  //         total_igst: Number(i.total_igst)
  //       }))
  //     });
  //   }

  //   return result;
  // }
  // private async getBranchWiseGST(
  //   client: any,
  //   companyId: number,
  //   startDate?: string,
  //   endDate?: string
  // ) {

  //   const branches = await executeInTransaction(client, `
  //   SELECT id, branch_name
  //   FROM branches
  //   WHERE company_id = $1
  // `, [companyId]);

  //   const result = [];

  //   for (const b of branches.rows) {

  //     const firms = await executeInTransaction(client, `
  //     SELECT id FROM firm WHERE branch_id = $1
  //   `, [b.id]);

  //     const firmIds = firms.rows.map((f: any) => f.id);

  //     if (!firmIds.length) continue;

  //     const summary = await this.getGSTSummarySalesOnly(
  //       client,
  //       firmIds,
  //       startDate,
  //       endDate
  //     );

  //     const firmData = await this.getFirmGSTSalesOnly(
  //       client,
  //       firmIds,
  //       startDate,
  //       endDate
  //     );

  //     result.push({
  //       branch_id: b.id,
  //       branch_name: b.branch_name,
  //       summary,
  //       firms_data: firmData
  //     });
  //   }

  //   return result;
  // }
  // async getGSTSalesReport(data: {
  //   level: "company" | "branch" | "firm";
  //   firm_id?: number;
  //   branch_id?: number;
  //   company_id?: number;
  //   start_date?: string;
  //   end_date?: string;
  // }) {

  //   const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

  //   return transaction(async (client) => {

  //     let firmIds: number[] = [];

  //     if (level === "firm" && firm_id) {
  //       firmIds = [firm_id];
  //     }

  //     if (level === "branch" && branch_id) {
  //       const res = await executeInTransaction(
  //         client,
  //         `SELECT id FROM firm WHERE branch_id = $1`,
  //         [branch_id]
  //       );
  //       firmIds = res.rows.map((r: any) => r.id);
  //     }

  //     if (level === "company" && company_id) {
  //       const res = await executeInTransaction(client, `
  //       SELECT f.id
  //       FROM firm f
  //       JOIN branches b ON b.id = f.branch_id
  //       WHERE b.company_id = $1
  //     `, [company_id]);

  //       firmIds = res.rows.map((r: any) => r.id);
  //     }

  //     if (!firmIds.length) {
  //       return { status: "success", data: { summary: {}, firms_data: [] } };
  //     }

  //     const summary = await this.getGSTSummarySalesOnly(
  //       client,
  //       firmIds,
  //       start_date,
  //       end_date
  //     );

  //     /* ===== LEVEL BASED ===== */

  //     if (level === "company") {
  //       const branchWise = await this.getBranchWiseGST(
  //         client,
  //         company_id!,
  //         start_date,
  //         end_date
  //       );

  //       return {
  //         status: "success",
  //         data: {
  //           summary,
  //           branch_wise: branchWise
  //         }
  //       };
  //     }

  //     /* firm + branch → firm data */

  //     const firms = await this.getFirmGSTSalesOnly(
  //       client,
  //       firmIds,
  //       start_date,
  //       end_date
  //     );

  //     return {
  //       status: "success",
  //       data: {
  //         summary,
  //         firms_data: firms
  //       }
  //     };
  //   });
  // }
  // 
  // 
  // 
 
  private async getGSTR3BSummary(
    client: any,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {
    const salesFilter = this.buildDateFilter("invoice_date", startDate, endDate, 2);
    const returnFilter = this.buildDateFilter("return_date", startDate, endDate, 4);

    const result = await executeInTransaction(client, `
    SELECT
      SUM(cgst) AS cgst,
      SUM(sgst) AS sgst,
      SUM(igst) AS igst
    FROM (

      SELECT total_cgst AS cgst, total_sgst AS sgst, total_igst AS igst
      FROM sales
      WHERE status != 0
      AND firm_id = ANY($1)
      ${salesFilter.clause}

      UNION ALL

      SELECT -total_cgst, -total_sgst, -total_igst
      FROM sale_return
      WHERE status != 0
      AND firm_id = ANY($1)
      ${returnFilter.clause}

    ) t
  `, [
      firmIds,
      ...salesFilter.values,
      ...returnFilter.values
    ]);

    const row = result.rows[0];

    return {
      total_cgst: Number(row.cgst || 0),
      total_sgst: Number(row.sgst || 0),
      total_igst: Number(row.igst || 0),
      total_tax:
        Number(row.cgst || 0) +
        Number(row.sgst || 0) +
        Number(row.igst || 0)
    };
  }
  private async getGSTR1Data(
    client: any,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {

    const salesFilter = this.buildDateFilter("s.invoice_date", startDate, endDate, 2);
    const returnFilter = this.buildDateFilter("sr.return_date", startDate, endDate, 4);

    const result = await executeInTransaction(client, `
    
    /* SALES (INVOICE) */
    SELECT 
      c.customer_type,
      c.gstin,
      c.state_code,
      s.invoice_number,
      s.invoice_date,
      s.net_amount AS taxable_value,
      s.total_cgst,
      s.total_sgst,
      s.total_igst,
      'INVOICE' as doc_type
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.status != 0
    AND c.status != 0
    AND s.firm_id = ANY($1)
    ${salesFilter.clause}

    UNION ALL

    /* SALES RETURN (CREDIT NOTE) */
    SELECT 
      c.customer_type,
      c.gstin,
      c.state_code,
      sr.return_number AS invoice_number,
      sr.return_date AS invoice_date,
      -sr.sub_total AS taxable_value,
      -sr.total_cgst,
      -sr.total_sgst,
      -sr.total_igst,
      'CREDIT_NOTE'
    FROM sale_return sr
    JOIN sales s ON s.id = sr.sale_id
    JOIN customers c ON c.id = s.customer_id
    WHERE sr.status != 0
    AND s.status != 0
    AND c.status != 0
    AND sr.firm_id = ANY($1)
    ${returnFilter.clause}

  `, [
      firmIds,
      ...salesFilter.values,
      ...returnFilter.values
    ]);

    const rows = result.rows;

    return {
      B2B: rows.filter((r: any) => r.customer_type === "B2B"),
      B2C: rows.filter((r: any) => r.customer_type !== "B2B"),
      credit_notes: rows.filter((r: any) => r.doc_type === "CREDIT_NOTE")
    };
  }
  // private async getBranchWiseData(
  //   client: any,
  //   company_id: number,
  //   startDate?: string,
  //   endDate?: string
  // ) {

  //   const branches = await executeInTransaction(client, `
  //   SELECT id, branch_name
  //   FROM branches
  //   WHERE company_id = $1
  // `, [company_id]);

  //   const result = [];

  //   for (const b of branches.rows) {

  //     const firms = await executeInTransaction(client, `
  //     SELECT id FROM firm WHERE branch_id = $1
  //   `, [b.id]);

  //     const firmIds = firms.rows.map((f: any) => f.id);

  //     const summary = await this.getGSTR3BSummary(
  //       client,
  //       firmIds,
  //       startDate,
  //       endDate
  //     );

  //     result.push({
  //       branch_name: b.branch_name,
  //       summary
  //     });
  //   }

  //   return result;
  // }
  async getGSTReport(data: GetGSTReportBody) {

    const { type, level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {

      let firmIds: number[] = [];

      // ✅ FIRM LEVEL
      if (level === "firm" && firm_id) {
        firmIds = [firm_id];
      }

      // ✅ BRANCH LEVEL
      if (level === "branch" && branch_id) {
        const res = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = res.rows.map((r: any) => r.id);
      }

      // ✅ COMPANY LEVEL (FIXED PROPERLY)
      if (level === "company" && company_id) {

        const branches = await executeInTransaction(client, `
        SELECT id, branch_name
        FROM branches
        WHERE company_id = $1
      `, [company_id]);

        const result = [];

        for (const b of branches.rows) {

          const firms = await executeInTransaction(
            client,
            `SELECT id FROM firm WHERE branch_id = $1`,
            [b.id]
          );

          const ids = firms.rows.map((f: any) => f.id);

          // 🔥 IMPORTANT: HANDLE TYPE HERE
          if (type === "GSTR-3B") {

            const summary = await this.getGSTR3BSummary(
              client,
              ids,
              start_date,
              end_date
            );

            result.push({
              branch_name: b.branch_name,
              summary
            });

          } else if (type === "GSTR-1") {

            const gstr1 = await this.getGSTR1Data(
              client,
              ids,
              start_date,
              end_date
            );

            result.push({
              branch_name: b.branch_name,
              data: gstr1
            });
          }
        }

        return {
          status: "success",
          data: result
        };
      }

      // ✅ NON-COMPANY FLOW (firm / branch)

      if (type === "GSTR-3B") {

        const summary = await this.getGSTR3BSummary(
          client,
          firmIds,
          start_date,
          end_date
        );

        return {
          status: "success",
          data: summary
        };
      }

      if (type === "GSTR-1") {

        const gstr1 = await this.getGSTR1Data(
          client,
          firmIds,
          start_date,
          end_date
        );

        return {
          status: "success",
          data: gstr1
        };
      }

    });
  }
  // 
  // GST END
  // 

  private async getExpenseSummary(
    client: any,
    whereClause: string,
    values: any[],
    dateIndex: number,
    startDate?: string,
    endDate?: string
  ) {

    const dateFilter = this.buildDateFilter(
      "lt.transaction_date",
      startDate,
      endDate,
      dateIndex
    );

    const result = await executeInTransaction(client, `
    SELECT 
      COALESCE(SUM(lt.amount), 0) AS total_amount
    FROM ledger_transactions lt
    JOIN ledger_categories lc ON lc.id = lt.category_id
    WHERE lt.status != 0
    AND lc.status != 0
    AND lc.category_type = 'E'
    ${whereClause}
    ${dateFilter.clause}
  `, [
      ...values,
      ...dateFilter.values
    ]);

    return Number(result.rows[0].total_amount || 0);
  }

  private async getExpenseCategories(
    client: any,
    whereClause: string,
    values: any[],
    dateIndex: number,
    startDate?: string,
    endDate?: string
  ) {

    const dateFilter = this.buildDateFilter(
      "lt.transaction_date",
      startDate,
      endDate,
      dateIndex
    );

    const result = await executeInTransaction(client, `
    SELECT 
      lc.name AS category_name,
      COALESCE(SUM(lt.amount), 0) AS total_amount
    FROM ledger_transactions lt
    JOIN ledger_categories lc ON lc.id = lt.category_id
    WHERE lt.status != 0
    AND lc.status != 0
    AND lc.category_type = 'E'
    ${whereClause}
    ${dateFilter.clause}
    GROUP BY lc.name
    ORDER BY total_amount DESC
  `, [
      ...values,
      ...dateFilter.values
    ]);

    return result.rows.map((r: any) => ({
      category_name: r.category_name,
      total_amount: Number(r.total_amount)
    }));
  }

  private async getFirmExpense(
    client: any,
    firm_id: number,
    startDate?: string,
    endDate?: string
  ) {

    const where = `AND lt.entity_type = 'F' AND lt.entity_id = $1`;

    const total = await this.getExpenseSummary(
      client,
      where,
      [firm_id],
      2,
      startDate,
      endDate
    );

    const categories = await this.getExpenseCategories(
      client,
      where,
      [firm_id],
      2,
      startDate,
      endDate
    );

    return {
      summary: { total_amount: total },
      categories
    };
  }

  private async getBranchExpense(
    client: any,
    branch_id: number,
    startDate?: string,
    endDate?: string
  ) {

    const where = `
    AND (
      (lt.entity_type = 'B' AND lt.entity_id = $1)
      OR
      (lt.entity_type = 'F' AND lt.entity_id IN (
        SELECT id FROM firm WHERE branch_id = $1
      ))
    )
  `;

    const total = await this.getExpenseSummary(
      client,
      where,
      [branch_id],
      2,
      startDate,
      endDate
    );

    const categories = await this.getExpenseCategories(
      client,
      where,
      [branch_id],
      2,
      startDate,
      endDate
    );

    // 🔹 Firm breakdown
    const firms = await executeInTransaction(
      client,
      `SELECT id, firm_name FROM firm WHERE branch_id = $1`,
      [branch_id]
    );

    const firmData = [];

    for (const f of firms.rows) {

      const firmTotal = await this.getExpenseSummary(
        client,
        `AND lt.entity_type = 'F' AND lt.entity_id = $1`,
        [f.id],
        2,
        startDate,
        endDate
      );

      firmData.push({
        firm_name: f.firm_name,
        total_amount: firmTotal
      });
    }

    return {
      summary: { total_amount: total },
      categories,
      firms: firmData
    };
  }

  private async getCompanyExpense(
    client: any,
    company_id: number,
    startDate?: string,
    endDate?: string
  ) {

    const where = `AND lt.company_id = $1`;

    const total = await this.getExpenseSummary(
      client,
      where,
      [company_id],
      2,
      startDate,
      endDate
    );

    const categories = await this.getExpenseCategories(
      client,
      where,
      [company_id],
      2,
      startDate,
      endDate
    );

    // 🔹 Branch breakdown
    const branches = await executeInTransaction(
      client,
      `SELECT id, branch_name FROM branches WHERE company_id = $1`,
      [company_id]
    );

    const branchData = [];

    for (const b of branches.rows) {

      const branchTotal = await this.getExpenseSummary(
        client,
        `
      AND (
        (lt.entity_type = 'B' AND lt.entity_id = $1)
        OR
        (lt.entity_type = 'F' AND lt.entity_id IN (
          SELECT id FROM firm WHERE branch_id = $1
        ))
      )
      `,
        [b.id],
        2,
        startDate,
        endDate
      );

      branchData.push({
        branch_name: b.branch_name,
        total_amount: branchTotal
      });
    }

    return {
      summary: { total_amount: total },
      categories,
      branches: branchData
    };
  }

  async getExpenseReport(data: {
    level: "company" | "branch" | "firm";
    firm_id?: number;
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
  }) {

    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {

      if (level === "firm" && firm_id) {
        return {
          status: "success",
          data: await this.getFirmExpense(client, firm_id, start_date, end_date)
        };
      }

      if (level === "branch" && branch_id) {
        return {
          status: "success",
          data: await this.getBranchExpense(client, branch_id, start_date, end_date)
        };
      }

      if (level === "company" && company_id) {
        return {
          status: "success",
          data: await this.getCompanyExpense(client, company_id, start_date, end_date)
        };
      }

      return {
        status: "success",
        data: {}
      };

    });
  }
}