import { PoolClient } from "pg";
import { executeInTransaction, transaction } from "../../config/db";
import { GetGSTReportBody, GetReportBody, PaymentReportInput } from "./report.types";

export class ReportService {
  // 
  // PROFIT LOSS REPORT START
  // 
  async getProfitLossReport(data: GetReportBody) {
    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {
      let firmIds: number[] = [];
      let branchIds: number[] = [];

      /* ================= RESOLVE ENTITY IDS ================= */

      if (level === "firm" && firm_id) {
        firmIds = [firm_id];
      }

      if (level === "branch" && branch_id) {
        branchIds = [branch_id];
        const res = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = res.rows.map((r: any) => r.id);
      }

      if (level === "company" && company_id) {
        const branchRes = await executeInTransaction(
          client,
          `SELECT id FROM branches WHERE company_id = $1`,
          [company_id]
        );
        branchIds = branchRes.rows.map((r: any) => r.id);

        if (branchIds.length > 0) {
          const firmRes = await executeInTransaction(
            client,
            `SELECT id FROM firm WHERE branch_id = ANY($1)`,
            [branchIds]
          );
          firmIds = firmRes.rows.map((r: any) => r.id);
        }
      }

      if (level === "firm" && !firmIds.length) {
        return this.emptyResponse();
      }

      /* ================= MAIN CONSOLIDATED SUMMARY ================= */

      const overall = await this.getSummaryAndBreakdown(
        client,
        firmIds,
        level,
        { firm_id, branch_id, company_id, firmIds, branchIds },
        start_date,
        end_date
      );

      /* ================= HIERARCHY LEVEL OUTPUTS ================= */

      // 1. Firm Level
      if (level === "firm") {
        return overall;
      }

      // 2. Branch Level (Branch summary + Firm breakdown)
      if (level === "branch") {
        const firmWise = await this.getFirmWiseReport(
          client,
          firmIds,
          start_date,
          end_date
        );

        return {
          ...overall,
          firms: firmWise
        };
      }

      // 3. Company Level (Company summary + Branch breakdown + Firm breakdown per Branch)
      if (level === "company") {
        const branches = await executeInTransaction(
          client,
          `SELECT id, branch_name FROM branches WHERE company_id = $1`,
          [company_id]
        );

        const branchWise = [];

        for (const b of branches.rows) {
          const firmsRes = await executeInTransaction(
            client,
            `SELECT id, firm_name FROM firm WHERE branch_id = $1`,
            [b.id]
          );

          const bFirmIds = firmsRes.rows.map((f: any) => f.id);

          let branchData: any = this.emptyResponse();

          if (bFirmIds.length) {
            branchData = await this.getSummaryAndBreakdown(
              client,
              bFirmIds,
              "branch",
              { branch_id: b.id, firmIds: bFirmIds },
              start_date,
              end_date
            );
          }

          const firmWise = await this.getFirmWiseReport(
            client,
            bFirmIds,
            start_date,
            end_date
          );

          branchWise.push({
            branch_id: b.id,
            branch_name: b.branch_name,
            ...branchData,
            firms: firmWise
          });
        }

        return {
          ...overall,
          branches: branchWise
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

  private getLedgerCondition(
    level: string,
    ids: { firm_id?: number; branch_id?: number; company_id?: number; firmIds?: number[]; branchIds?: number[] },
    startIndex: number = 1
  ) {
    if (level === "firm") {
      return {
        condition: `lt.entity_type = 'F' AND lt.entity_id = $${startIndex}`,
        values: [ids.firm_id],
        nextIndex: startIndex + 1
      };
    }

    if (level === "branch") {
      return {
        condition: `(
          (lt.entity_type = 'B' AND lt.entity_id = $${startIndex})
          OR
          (lt.entity_type = 'F' AND lt.entity_id = ANY($${startIndex + 1}))
        )`,
        values: [ids.branch_id, ids.firmIds || []],
        nextIndex: startIndex + 2
      };
    }

    // Company level
    return {
      condition: `(
        (lt.entity_type = 'C' AND lt.entity_id = $${startIndex})
        OR
        (lt.entity_type = 'B' AND lt.entity_id = ANY($${startIndex + 1}))
        OR
        (lt.entity_type = 'F' AND lt.entity_id = ANY($${startIndex + 2}))
      )`,
      values: [ids.company_id, ids.branchIds || [], ids.firmIds || []],
      nextIndex: startIndex + 3
    };
  }

  private async getSummaryAndBreakdown(
    client: any,
    firmIds: number[],
    level: string,
    ids: { firm_id?: number; branch_id?: number; company_id?: number; firmIds?: number[]; branchIds?: number[] },
    startDate?: string,
    endDate?: string
  ) {
    /* ===== SALES ===== */
    const salesFilter = this.buildDateFilter("invoice_date", startDate, endDate, 2);
    const sales = await executeInTransaction(client, `
      SELECT COALESCE(SUM(final_amount),0) AS total
      FROM sales
      WHERE status != 0 AND firm_id = ANY($1)
      ${salesFilter.clause}
    `, [firmIds, ...salesFilter.values]);

    /* ===== PURCHASE RETURN ===== */
    const prFilter = this.buildDateFilter("return_date", startDate, endDate, 2);
    const purchaseReturn = await executeInTransaction(client, `
      SELECT COALESCE(SUM(final_amount),0) AS total
      FROM purchase_return
      WHERE status != 0 AND firm_id = ANY($1)
      ${prFilter.clause}
    `, [firmIds, ...prFilter.values]);

    /* ===== PURCHASES ===== */
    const purchaseFilter = this.buildDateFilter("bill_date", startDate, endDate, 2);
    const purchases = await executeInTransaction(client, `
      SELECT COALESCE(SUM(final_amount),0) AS total
      FROM purchases
      WHERE status != 0 AND firm_id = ANY($1)
      ${purchaseFilter.clause}
    `, [firmIds, ...purchaseFilter.values]);

    /* ===== SALES RETURN ===== */
    const srFilter = this.buildDateFilter("return_date", startDate, endDate, 2);
    const saleReturn = await executeInTransaction(client, `
      SELECT COALESCE(SUM(final_amount),0) AS total
      FROM sale_return
      WHERE status != 0 AND firm_id = ANY($1)
      ${srFilter.clause}
    `, [firmIds, ...srFilter.values]);

    /* ===== EXPENSES ===== */
    const ledgerFilter = this.getLedgerCondition(level, ids, 1);
    const expenseDateFilter = this.buildDateFilter(
      "lt.transaction_date",
      startDate,
      endDate,
      ledgerFilter.nextIndex
    );

    const expenses = await executeInTransaction(client, `
      SELECT 
        lc.name,
        COALESCE(SUM(lt.amount), 0) AS amount
      FROM ledger_transactions lt
      JOIN ledger_categories lc ON lc.id = lt.ledger_category_id
      WHERE lt.status != 0 AND lc.status != 0 AND lc.category_type = 'E'
      AND ${ledgerFilter.condition}
      ${expenseDateFilter.clause}
      GROUP BY lc.name
    `, [
      ...ledgerFilter.values,
      ...expenseDateFilter.values
    ]);

    /* ===== OTHER INDIRECT INCOMES ===== */
    const incomeDateFilter = this.buildDateFilter(
      "lt.transaction_date",
      startDate,
      endDate,
      ledgerFilter.nextIndex
    );

    const indirectIncomes = await executeInTransaction(client, `
      SELECT 
        lc.name,
        COALESCE(SUM(lt.amount), 0) AS amount
      FROM ledger_transactions lt
      JOIN ledger_categories lc ON lc.id = lt.ledger_category_id
      WHERE lt.status != 0 AND lc.status != 0 AND lc.category_type = 'I'
      AND ${ledgerFilter.condition}
      ${incomeDateFilter.clause}
      GROUP BY lc.name
    `, [
      ...ledgerFilter.values,
      ...incomeDateFilter.values
    ]);

    const totalExpense = expenses.rows.reduce(
      (a: number, b: any) => a + Number(b.amount),
      0
    );

    const totalOtherIncome = indirectIncomes.rows.reduce(
      (a: number, b: any) => a + Number(b.amount),
      0
    );

    const totalSales = Number(sales.rows[0].total);
    const totalPurchaseReturn = Number(purchaseReturn.rows[0].total);
    const totalPurchases = Number(purchases.rows[0].total);
    const totalSaleReturn = Number(saleReturn.rows[0].total);

    const grossRevenue = totalSales + totalPurchaseReturn;
    const cogs = totalPurchases + totalSaleReturn;
    const grossProfit = grossRevenue - cogs;
    const netProfit = grossProfit + totalOtherIncome - totalExpense;
    return {
      summary: {
        revenue: grossRevenue,
        cogs,
        gross_profit: grossProfit,
        other_income: totalOtherIncome,
        operating_expenses: totalExpense,
        net_profit: netProfit
      },
      breakdown: {
        income_streams: [
          { description: "Sales", amount: totalSales },
          { description: "Purchase Return", amount: totalPurchaseReturn },
          ...indirectIncomes.rows.map((i: any) => ({
            description: i.name,
            amount: Number(i.amount)
          }))
        ],
        cost_of_goods: [
          { description: "Purchases", amount: totalPurchases },
          { description: "Sales Return", amount: totalSaleReturn }
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
    if (!firmIds.length) return [];

    const firms = await executeInTransaction(client, `
      SELECT id, firm_name 
      FROM firm 
      WHERE id = ANY($1)
    `, [firmIds]);

    const result = [];

    for (const f of firms.rows) {
      let data: any = this.emptyResponse();

      try {
        const reportData = await this.getSummaryAndBreakdown(
          client,
          [f.id],
          "firm",
          { firm_id: f.id },
          startDate,
          endDate
        );

        if (reportData) {
          data = reportData;
        }
      } catch (err) {
        // Fallback to empty response on error
      }

      result.push({
        firm_id: f.id,
        firm_name: f.firm_name,
        ...data
      });
    }

    return result;
  }

  private emptyResponse() {
    return {
      summary: {
        revenue: 0,
        cogs: 0,
        gross_profit: 0,
        other_income: 0,
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
  // EXPENSE REPORT START
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
      JOIN ledger_categories lc ON lc.id = lt.ledger_category_id
      WHERE lt.status != 0
      AND lc.status != 0
      AND lc.category_type = 'E'
      ${whereClause}
      ${dateFilter.clause}
    `, [
      ...values,
      ...dateFilter.values
    ]);

    return Number(result.rows[0]?.total_amount || 0);
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
      JOIN ledger_categories lc ON lc.id = lt.ledger_category_id
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
  // 
  // EXPENSE REPORT END
  // 

  // 
  // INCOME REPORT START
  // 
  private async getIncomeSummary(
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
      JOIN ledger_categories lc ON lc.id = lt.ledger_category_id
      WHERE lt.status != 0
      AND lc.status != 0
      AND lc.category_type = 'I'
      ${whereClause}
      ${dateFilter.clause}
    `, [
      ...values,
      ...dateFilter.values
    ]);

    return Number(result.rows[0]?.total_amount || 0);
  }

  private async getIncomeCategories(
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
      JOIN ledger_categories lc ON lc.id = lt.ledger_category_id
      WHERE lt.status != 0
      AND lc.status != 0
      AND lc.category_type = 'I'
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

  private async getFirmIncome(
    client: any,
    firm_id: number,
    startDate?: string,
    endDate?: string
  ) {
    const where = `AND lt.entity_type = 'F' AND lt.entity_id = $1`;

    const total = await this.getIncomeSummary(
      client,
      where,
      [firm_id],
      2,
      startDate,
      endDate
    );

    const categories = await this.getIncomeCategories(
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

  private async getBranchIncome(
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

    const total = await this.getIncomeSummary(
      client,
      where,
      [branch_id],
      2,
      startDate,
      endDate
    );

    const categories = await this.getIncomeCategories(
      client,
      where,
      [branch_id],
      2,
      startDate,
      endDate
    );

    const firms = await executeInTransaction(
      client,
      `SELECT id, firm_name FROM firm WHERE branch_id = $1`,
      [branch_id]
    );

    const firmData = [];

    for (const f of firms.rows) {
      const firmTotal = await this.getIncomeSummary(
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

  private async getCompanyIncome(
    client: any,
    company_id: number,
    startDate?: string,
    endDate?: string
  ) {
    const where = `AND lt.company_id = $1`;

    const total = await this.getIncomeSummary(
      client,
      where,
      [company_id],
      2,
      startDate,
      endDate
    );

    const categories = await this.getIncomeCategories(
      client,
      where,
      [company_id],
      2,
      startDate,
      endDate
    );

    const branches = await executeInTransaction(
      client,
      `SELECT id, branch_name FROM branches WHERE company_id = $1`,
      [company_id]
    );

    const branchData = [];

    for (const b of branches.rows) {
      const branchTotal = await this.getIncomeSummary(
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

  async getIncomeReport(data: {
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
          data: await this.getFirmIncome(client, firm_id, start_date, end_date)
        };
      }

      if (level === "branch" && branch_id) {
        return {
          status: "success",
          data: await this.getBranchIncome(client, branch_id, start_date, end_date)
        };
      }

      if (level === "company" && company_id) {
        return {
          status: "success",
          data: await this.getCompanyIncome(client, company_id, start_date, end_date)
        };
      }

      return {
        status: "success",
        data: {}
      };
    });
  }
  // 
  // INCOME REPORT END
  // 

  // 
  // START OUTSTANDING
  // 
  async getOutstandingReport(data: GetReportBody) {
    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {
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

      const overall = await this.getData(
        client,
        firmIds,
        start_date,
        end_date
      );

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
    client: PoolClient,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {
    const dateFilter = this.buildDateFilter(
      "doc_date",
      startDate,
      endDate
    );

    const result = await executeInTransaction(
      client,
      `
    WITH pending_docs AS (
      SELECT 
        'S' AS ref_type,
        c.customer_name AS party_name,
        s.invoice_number AS doc_number,
        s.invoice_date AS doc_date,
        s.final_amount AS total_amount,
        (s.final_amount - s.paid) AS pending_amount,
        s.firm_id
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.status != 0 
        AND (s.final_amount - s.paid) > 0
        AND s.firm_id = ANY($1)

      UNION ALL

      SELECT 
        'P' AS ref_type,
        v.vendor_name AS party_name,
        p.bill_number AS doc_number,
        p.bill_date AS doc_date,
        p.final_amount AS total_amount,
        (p.final_amount - p.paid_amount) AS pending_amount,
        p.firm_id
      FROM purchases p
      LEFT JOIN vendors v ON v.id = p.vendor_id
      WHERE p.status != 0 
        AND (p.final_amount - p.paid_amount) > 0
        AND p.firm_id = ANY($1)
    )
    SELECT 
      ref_type,
      party_name,
      doc_number,
      doc_date,
      total_amount,
      pending_amount,
      (CURRENT_DATE - doc_date) AS aging_days,
      CASE
        WHEN (CURRENT_DATE - doc_date) BETWEEN 0 AND 30 THEN '0-30'
        WHEN (CURRENT_DATE - doc_date) BETWEEN 31 AND 60 THEN '31-60'
        WHEN (CURRENT_DATE - doc_date) BETWEEN 61 AND 90 THEN '61-90'
        ELSE '90+'
      END AS aging_bucket
    FROM pending_docs
    WHERE 1=1
    ${dateFilter.clause}
    ORDER BY doc_date ASC
  `,
      [firmIds, ...dateFilter.values]
    );

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
        case "0-30":
          bucket_0_30 += pending;
          break;
        case "31-60":
          bucket_31_60 += pending;
          break;
        case "61-90":
          bucket_61_90 += pending;
          break;
        default:
          bucket_90_plus += pending;
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
        aging_days: Number(row.aging_days),
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

  private async getBranchWiseReport(
    client: any,
    companyId: number,
    startDate?: string,
    endDate?: string
  ) {
    const branches = await executeInTransaction(client, `
      SELECT id, branch_name 
      FROM branches 
      WHERE company_id = $1
    `, [companyId]);

    const result = [];

    for (const b of branches.rows) {
      const firms = await executeInTransaction(client, `
        SELECT id 
        FROM firm 
        WHERE branch_id = $1
      `, [b.id]);

      const firmIds = firms.rows.map((f: any) => f.id);

      let data: any = this.emptyResponse();

      if (firmIds.length) {
        data = await this.getSummaryAndBreakdown(
          client,
          firmIds,
          "branch",
          { branch_id: b.id, firmIds },
          startDate,
          endDate
        );
      }

      result.push({
        branch_id: b.id,
        branch_name: b.branch_name,
        ...data
      });
    }

    return result;
  }

  private async getGSTINMap(client: any, level: string, ids: number[]) {
    let query = "";

    if (level === "firm") {
      query = `SELECT id, gstin FROM firm WHERE id = ANY($1)`;
    }

    if (level === "branch") {
      query = `SELECT id, gstin FROM branches WHERE id = ANY($1)`;
    }

    if (level === "company") {
      query = `SELECT id, gstin FROM company WHERE id = ANY($1)`;
    }

    const res = await executeInTransaction(client, query, [ids]);
    const map: any = {};
    res.rows.forEach((r: any) => {
      map[r.id] = r.gstin;
    });

    return map;
  }

  // private async getGSTR3BWithGrouping(
  //   client: any,
  //   firmIds: number[],
  //   startDate?: string,
  //   endDate?: string
  // ) {
  //   const salesFilter = this.buildDateFilter("s.invoice_date", startDate, endDate, 2);
  //   const saleReturnFilter = this.buildDateFilter("sr.return_date", startDate, endDate, 4);
  //   const purchaseFilter = this.buildDateFilter("s.invoice_date", startDate, endDate, 2);
  //   const purchaseReturnFilter = this.buildDateFilter("sr.return_date", startDate, endDate, 4);

  //   const result = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     f.gstin,

  //     SUM(data.cgst) AS total_cgst,
  //     SUM(data.sgst) AS total_sgst,
  //     SUM(data.igst) AS total_igst

  //   FROM (

  //     SELECT 
  //       s.firm_id,
  //       s.total_cgst AS cgst,
  //       s.total_sgst AS sgst,
  //       s.total_igst AS igst
  //     FROM sales s
  //     WHERE s.status != 0
  //     AND s.firm_id = ANY($1)
  //     ${salesFilter.clause}

  //     UNION ALL

  //     SELECT 
  //       sr.firm_id,
  //       -sr.total_cgst,
  //       -sr.total_sgst,
  //       -sr.total_igst
  //     FROM sale_return sr
  //     WHERE sr.status != 0
  //     AND sr.firm_id = ANY($1)
  //     ${saleReturnFilter.clause}

  //   ) data

  //   JOIN firm f ON f.id = data.firm_id

  //   GROUP BY f.gstin
  //   `,
  //     [
  //       firmIds,
  //       ...salesFilter.values,
  //       ...saleReturnFilter.values
  //     ]
  //   );

  //   const rows = result.rows;

  //   const gstin_groups = rows.map((r: any) => {
  //     const cgst = Number(r.total_cgst || 0);
  //     const sgst = Number(r.total_sgst || 0);
  //     const igst = Number(r.total_igst || 0);

  //     return {
  //       gstin: r.gstin || "UNKNOWN",
  //       total_cgst: cgst,
  //       total_sgst: sgst,
  //       total_igst: igst,
  //       total_tax: cgst + sgst + igst
  //     };
  //   });

  //   const summary = gstin_groups.reduce(
  //     (acc: any, g: any) => {
  //       acc.total_cgst += g.total_cgst;
  //       acc.total_sgst += g.total_sgst;
  //       acc.total_igst += g.total_igst;
  //       acc.total_tax += g.total_tax;
  //       return acc;
  //     },
  //     {
  //       total_cgst: 0,
  //       total_sgst: 0,
  //       total_igst: 0,
  //       total_tax: 0
  //     }
  //   );

  //   return {
  //     summary,
  //     gstin_groups
  //   };
  // }

  // private async getGSTR1Data(
  //   client: any,
  //   firmIds: number[],
  //   gstin: string,
  //   startDate?: string,
  //   endDate?: string
  // ) {
  //   const salesFilter = this.buildDateFilter("s.invoice_date", startDate, endDate, 2);
  //   const returnFilter = this.buildDateFilter("sr.return_date", startDate, endDate, 4);

  //   const result = await executeInTransaction(client, `
  //     SELECT 
  //       c.customer_type,
  //       c.gstin,
  //       c.state_code,
  //       s.invoice_number,
  //       s.invoice_date,
  //       s.net_amount AS taxable_value,
  //       s.total_cgst,
  //       s.total_sgst,
  //       s.total_igst,
  //       'INVOICE' as doc_type
  //     FROM sales s
  //     JOIN customers c ON c.id = s.customer_id
  //     WHERE s.status != 0
  //     AND c.status != 0
  //     AND s.firm_id = ANY($1)
  //     ${salesFilter.clause}

  //     UNION ALL

  //     SELECT 
  //       c.customer_type,
  //       c.gstin,
  //       c.state_code,
  //       sr.return_number,
  //       sr.return_date,
  //       -sr.final_amount,
  //       -sr.total_cgst,
  //       -sr.total_sgst,
  //       -sr.total_igst,
  //       'SALE_RETURN'
  //     FROM sale_return sr
  //     JOIN sales s ON s.id = sr.sale_id
  //     JOIN customers c ON c.id = s.customer_id
  //     WHERE sr.status != 0
  //     AND s.status != 0
  //     AND c.status != 0
  //     AND sr.firm_id = ANY($1)
  //     ${returnFilter.clause}
  //   `, [
  //     firmIds,
  //     ...salesFilter.values,
  //     ...returnFilter.values
  //   ]);

  //   const rows = result.rows;

  //   const invoices = rows.filter((r: any) => r.doc_type === "INVOICE");
  //   const creditNotes = rows.filter((r: any) => r.doc_type === "SALE_RETURN");

  //   const B2B = invoices.filter((r: any) => r.customer_type === "B2B");
  //   const B2C = invoices.filter((r: any) => r.customer_type !== "B2B");

  //   const groupedB2B = Object.values(
  //     B2B.reduce((acc: any, row: any) => {
  //       const key = row.gstin;

  //       if (!acc[key]) {
  //         acc[key] = {
  //           gstin: row.gstin,
  //           invoices: [],
  //           total_taxable: 0,
  //           total_tax: 0
  //         };
  //       }

  //       acc[key].invoices.push(row);
  //       acc[key].total_taxable += Number(row.taxable_value);
  //       acc[key].total_tax +=
  //         Number(row.total_cgst) +
  //         Number(row.total_sgst) +
  //         Number(row.total_igst);

  //       return acc;
  //     }, {})
  //   );

  //   const groupedB2C = Object.values(
  //     B2C.reduce((acc: any, row: any) => {
  //       const key = row.state_code || "UNKNOWN";

  //       if (!acc[key]) {
  //         acc[key] = {
  //           state_code: row.state_code,
  //           total_taxable: 0,
  //           total_tax: 0,
  //           invoices: []
  //         };
  //       }

  //       acc[key].invoices.push(row);
  //       acc[key].total_taxable += Number(row.taxable_value);
  //       acc[key].total_tax +=
  //         Number(row.total_cgst) +
  //         Number(row.total_sgst) +
  //         Number(row.total_igst);

  //       return acc;
  //     }, {})
  //   );

  //   return {
  //     gstin,
  //     B2B: groupedB2B,
  //     B2C: groupedB2C,
  //     credit_notes: creditNotes
  //   };
  // }

 // ==========================================
  // GST REPORT METHODS
  // ==========================================

  async getGSTReport(data: GetGSTReportBody) {
    const { type, level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {
      let firmIds: number[] = [];
      let entityIds: number[] = [];

      /* ================= RESOLVE ENTITIES ================= */
      if (level === "firm" && firm_id) {
        firmIds = [firm_id];
        entityIds = [firm_id];
      }

      if (level === "branch" && branch_id) {
        entityIds = [branch_id];
        const res = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = res.rows.map((r: any) => r.id);
      }

      if (level === "company" && company_id) {
        entityIds = [company_id];
        const branchRes = await executeInTransaction(
          client,
          `SELECT id FROM branches WHERE company_id = $1`,
          [company_id]
        );
        const branchIds = branchRes.rows.map((b: any) => b.id);

        if (branchIds.length > 0) {
          const firmRes = await executeInTransaction(
            client,
            `SELECT id FROM firm WHERE branch_id = ANY($1)`,
            [branchIds]
          );
          firmIds = firmRes.rows.map((r: any) => r.id);
        }
      }

      if (!firmIds.length) {
        return { status: "success", level, data: {} };
      }

      const gstinMap = await this.getGSTINMap(client, level, entityIds);
      const gstin = gstinMap[entityIds[0]] || "ALL";

      /* ================= GSTR-3B ================= */
      if (type === "GSTR-3B") {
        const report = await this.getGSTR3BWithGrouping(
          client,
          firmIds,
          start_date,
          end_date
        );

        return {
          status: "success",
          level,
          data: report
        };
      }

      /* ================= GSTR-1 ================= */
      if (type === "GSTR-1") {
        const gstr1 = await this.getGSTR1Data(
          client,
          firmIds,
          gstin,
          start_date,
          end_date
        );

        return {
          status: "success",
          level,
          data: gstr1
        };
      }
    });
  }

  /* 
   * GSTR-3B: Aggregates Outward Tax (Sales - Sale Return) 
   * and Input Tax Credit (Purchases - Purchase Return)
   */
 /* 
   * GSTR-3B: Aggregates Outward Tax (Sales - Sale Return) 
   * and Input Tax Credit (Purchases - Purchase Return)
   */
  private async getGSTR3BWithGrouping(
    client: any,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {
    const hasDates = Boolean(startDate && endDate);
    
    // $1 = firmIds (array), $2 = startDate, $3 = endDate
    const params = hasDates ? [firmIds, startDate, endDate] : [firmIds];

    const salesDateClause = hasDates ? `AND s.invoice_date BETWEEN $2 AND $3` : ``;
    const sReturnDateClause = hasDates ? `AND sr.return_date BETWEEN $2 AND $3` : ``;
    const purchaseDateClause = hasDates ? `AND p.bill_date BETWEEN $2 AND $3` : ``;
    const pReturnDateClause = hasDates ? `AND pr.return_date BETWEEN $2 AND $3` : ``;

    const result = await executeInTransaction(
      client,
      `
      SELECT 
        f.gstin,

        -- Outward Tax Liability (Sales - Sale Return)
        SUM(data.outward_taxable) AS outward_taxable,
        SUM(data.outward_cgst) AS outward_cgst,
        SUM(data.outward_sgst) AS outward_sgst,
        SUM(data.outward_igst) AS outward_igst,

        -- Input Tax Credit / ITC (Purchases - Purchase Return)
        SUM(data.itc_taxable) AS itc_taxable,
        SUM(data.itc_cgst) AS itc_cgst,
        SUM(data.itc_sgst) AS itc_sgst,
        SUM(data.itc_igst) AS itc_igst

      FROM (

        /* 1. SALES (Outward Supply) */
        SELECT 
          s.firm_id,
          s.net_amount AS outward_taxable,
          s.total_cgst AS outward_cgst,
          s.total_sgst AS outward_sgst,
          s.total_igst AS outward_igst,
          0 AS itc_taxable, 0 AS itc_cgst, 0 AS itc_sgst, 0 AS itc_igst
        FROM sales s
        WHERE s.status != 0 AND s.firm_id = ANY($1)
        ${salesDateClause}

        UNION ALL

        /* 2. SALE RETURN (Negative Outward Supply) */
        SELECT 
          sr.firm_id,
          -sr.sub_total,
          -sr.total_cgst,
          -sr.total_sgst,
          -sr.total_igst,
          0, 0, 0, 0
        FROM sale_return sr
        WHERE sr.status != 0 AND sr.firm_id = ANY($1)
        ${sReturnDateClause}

        UNION ALL

        /* 3. PURCHASES (Input Tax Credit) */
        SELECT 
          p.firm_id,
          0, 0, 0, 0,
          p.net_amount AS itc_taxable,
          p.total_cgst AS itc_cgst,
          p.total_sgst AS itc_sgst,
          p.total_igst AS itc_igst
        FROM purchases p
        WHERE p.status != 0 AND p.firm_id = ANY($1)
        ${purchaseDateClause}

        UNION ALL

        /* 4. PURCHASE RETURN (Negative Input Tax Credit) */
        SELECT 
          pr.firm_id,
          0, 0, 0, 0,
          -pr.sub_total,
          -pr.total_cgst,
          -pr.total_sgst,
          -pr.total_igst
        FROM purchase_return pr
        WHERE pr.status != 0 AND pr.firm_id = ANY($1)
        ${pReturnDateClause}

      ) data

      JOIN firm f ON f.id = data.firm_id
      GROUP BY f.gstin
      `,
      params
    );

    const gstin_groups = result.rows.map((r: any) => {
      const outward_cgst = Number(r.outward_cgst || 0);
      const outward_sgst = Number(r.outward_sgst || 0);
      const outward_igst = Number(r.outward_igst || 0);
      const outward_tax = outward_cgst + outward_sgst + outward_igst;

      const itc_cgst = Number(r.itc_cgst || 0);
      const itc_sgst = Number(r.itc_sgst || 0);
      const itc_igst = Number(r.itc_igst || 0);
      const total_itc = itc_cgst + itc_sgst + itc_igst;

      return {
        gstin: r.gstin || "UNKNOWN",
        outward_supplies: {
          taxable_value: Number(r.outward_taxable || 0),
          cgst: outward_cgst,
          sgst: outward_sgst,
          igst: outward_igst,
          total_tax: outward_tax
        },
        eligible_itc: {
          taxable_value: Number(r.itc_taxable || 0),
          cgst: itc_cgst,
          sgst: itc_sgst,
          igst: itc_igst,
          total_itc
        },
        net_payable: {
          cgst: outward_cgst - itc_cgst,
          sgst: outward_sgst - itc_sgst,
          igst: outward_igst - itc_igst,
          total_net_tax: outward_tax - total_itc
        }
      };
    });

    const summary = gstin_groups.reduce(
      (acc: any, g: any) => {
        acc.total_outward_tax += g.outward_supplies.total_tax;
        acc.total_itc_available += g.eligible_itc.total_itc;
        acc.net_tax_payable += g.net_payable.total_net_tax;
        return acc;
      },
      { total_outward_tax: 0, total_itc_available: 0, net_tax_payable: 0 }
    );

    return {
      summary,
      gstin_groups
    };
  }

  /* 
   * GSTR-1: Outward Sales & Sale Returns grouped into B2B, B2C, and Credit Notes
   */
  private async getGSTR1Data(
    client: any,
    firmIds: number[],
    gstin: string,
    startDate?: string,
    endDate?: string
  ) {
    const hasDates = Boolean(startDate && endDate);

    // $1 = firmIds (array), $2 = startDate, $3 = endDate
    const params = hasDates ? [firmIds, startDate, endDate] : [firmIds];

    const salesDateClause = hasDates ? `AND s.invoice_date BETWEEN $2 AND $3` : ``;
    const returnDateClause = hasDates ? `AND sr.return_date BETWEEN $2 AND $3` : ``;

    const result = await executeInTransaction(client, `
      SELECT 
        c.customer_type,
        c.gstin,
        c.state_code,
        s.invoice_number AS doc_number,
        s.invoice_date AS doc_date,
        s.net_amount AS taxable_value,
        s.total_cgst,
        s.total_sgst,
        s.total_igst,
        'INVOICE' as doc_type
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.status != 0 AND c.status != 0 AND s.firm_id = ANY($1)
      ${salesDateClause}

      UNION ALL

      SELECT 
        c.customer_type,
        c.gstin,
        c.state_code,
        sr.return_number AS doc_number,
        sr.return_date AS doc_date,
        -sr.sub_total AS taxable_value,
        -sr.total_cgst,
        -sr.total_sgst,
        -sr.total_igst,
        'SALE_RETURN' AS doc_type
      FROM sale_return sr
      JOIN sales s ON s.id = sr.sale_id
      JOIN customers c ON c.id = s.customer_id
      WHERE sr.status != 0 AND s.status != 0 AND c.status != 0 AND sr.firm_id = ANY($1)
      ${returnDateClause}
    `, params);

    const rows = result.rows;
    const invoices = rows.filter((r: any) => r.doc_type === "INVOICE");
    const creditNotes = rows.filter((r: any) => r.doc_type === "SALE_RETURN");

    const B2B = invoices.filter((r: any) => r.customer_type === "B2B");
    const B2C = invoices.filter((r: any) => r.customer_type !== "B2B");

    const groupedB2B = Object.values(
      B2B.reduce((acc: any, row: any) => {
        const key = row.gstin || "UNKNOWN";
        if (!acc[key]) {
          acc[key] = { gstin: key, invoices: [], total_taxable: 0, total_tax: 0 };
        }
        acc[key].invoices.push(row);
        acc[key].total_taxable += Number(row.taxable_value);
        acc[key].total_tax += Number(row.total_cgst) + Number(row.total_sgst) + Number(row.total_igst);
        return acc;
      }, {})
    );

    const groupedB2C = Object.values(
      B2C.reduce((acc: any, row: any) => {
        const key = row.state_code || "UNKNOWN";
        if (!acc[key]) {
          acc[key] = { state_code: key, total_taxable: 0, total_tax: 0, invoices: [] };
        }
        acc[key].invoices.push(row);
        acc[key].total_taxable += Number(row.taxable_value);
        acc[key].total_tax += Number(row.total_cgst) + Number(row.total_sgst) + Number(row.total_igst);
        return acc;
      }, {})
    );

    return {
      gstin,
      B2B: groupedB2B,
      B2C: groupedB2C,
      credit_notes: creditNotes
    };
  }

  /* 
   * GSTR-1: Outward Sales & Sale Returns grouped into B2B, B2C, and Credit Notes
   */


  // 
  // PAYMENT REPORT START
  // 
  async getPaymentReport(data: PaymentReportInput) {
    const {
      level,
      company_id,
      branch_id,
      firm_id,
      flow = "all",
      method_filter,
      start_date,
      end_date
    } = data;

    return transaction(async (client) => {
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
        return {
          summary: { total_received: 0, total_transactions: 0, top_method: "" },
          methods: [],
          branches: [],
          firms: [],
          transactions: []
        };
      }

      const result = await executeInTransaction(client, `
    SELECT
      pt.id,
      pt.amount,
      pt.transaction_reference,
      pt.payment_method_id,
      pm.method_name,

      f.id AS firm_id,
      f.firm_name,
      b.id AS branch_id,
      b.branch_name,

      CASE
        WHEN pt.ref_type = 'SL' THEN 'in'
        WHEN pt.ref_type = 'SR' THEN 'out'
        WHEN pt.ref_type = 'PS' THEN 'out'
        WHEN pt.ref_type = 'PR' THEN 'in'
        WHEN pt.ref_type = 'BL' THEN 
          CASE WHEN pb.flow = 'I' THEN 'in' ELSE 'out' END
      END AS flow,

      CASE
        WHEN pt.ref_type = 'SL' THEN 'sale'
        WHEN pt.ref_type = 'SR' THEN 'sale return'
        WHEN pt.ref_type = 'PS' THEN 'purchase'
        WHEN pt.ref_type = 'PR' THEN 'purchase return'
        ELSE 'balance'
      END AS type,

      COALESCE(
        s.invoice_date,
        sr.return_date,
        p.bill_date,
        pr.return_date
      ) AS date,

      COALESCE(
        s.invoice_number,
        sr.return_number,
        p.bill_number,
        pr.return_number
      ) AS invoice,

      COALESCE(
        c.customer_name,
        c2.customer_name,
        v.vendor_name,
        v2.vendor_name
      ) AS party_name

    FROM payment_transactions pt

    LEFT JOIN payment_methods pm ON pm.id = pt.payment_method_id

    LEFT JOIN sales s 
      ON pt.ref_id = s.id AND pt.ref_type = 'SL'
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN firm f1 ON f1.id = s.firm_id

    LEFT JOIN sale_return sr 
      ON pt.ref_id = sr.id AND pt.ref_type = 'SR'
    LEFT JOIN sales s2 ON sr.sale_id = s2.id
    LEFT JOIN customers c2 ON c2.id = s2.customer_id
    LEFT JOIN firm f2 ON f2.id = sr.firm_id

    LEFT JOIN purchases p 
      ON pt.ref_id = p.id AND pt.ref_type = 'PS'
    LEFT JOIN vendors v ON v.id = p.vendor_id
    LEFT JOIN firm f3 ON f3.id = p.firm_id

    LEFT JOIN purchase_return pr 
      ON pt.ref_id = pr.id AND pt.ref_type = 'PR'
    LEFT JOIN purchases p2 ON pr.purchase_id = p2.id
    LEFT JOIN vendors v2 ON v2.id = p2.vendor_id
    LEFT JOIN firm f4 ON f4.id = pr.firm_id

    LEFT JOIN party_balance pb 
      ON pt.ref_id = pb.id AND pt.ref_type = 'BL'
    LEFT JOIN firm f5 ON f5.id = pb.firm_id

    LEFT JOIN firm f ON f.id = COALESCE(f1.id, f2.id, f3.id, f4.id, f5.id)
    LEFT JOIN branches b ON b.id = f.branch_id

    WHERE pt.status != 0
    AND f.id = ANY($1)
  `, [firmIds]);

      let rows = result.rows;

      if (start_date && end_date) {
        rows = rows.filter((r: any) => {
          const d = new Date(r.date);
          return d >= new Date(start_date) && d <= new Date(end_date);
        });
      }

      if (flow !== "all") {
        rows = rows.filter((r: any) => r.flow === flow);
      }

      if (method_filter) {
        rows = rows.filter((r: any) => r.payment_method_id === method_filter);
      }

      const total_received = rows.reduce((a: number, b: any) => a + Number(b.amount), 0);
      const total_transactions = rows.length;

      const methodMap: any = {};
      rows.forEach((r: any) => {
        if (!methodMap[r.method_name]) {
          methodMap[r.method_name] = {
            method_name: r.method_name,
            total_amount: 0,
            transaction_count: 0
          };
        }
        methodMap[r.method_name].total_amount += Number(r.amount);
        methodMap[r.method_name].transaction_count++;
      });

      const methods = Object.values(methodMap).map((m: any) => ({
        ...m,
        percentage: total_received
          ? Number(((m.total_amount / total_received) * 100).toFixed(2))
          : 0
      }));

      const top_method =
        methods.sort((a: any, b: any) => b.total_amount - a.total_amount)[0]?.method_name || "";

      const branchMap: any = {};
      rows.forEach((r: any) => {
        if (!branchMap[r.branch_id]) {
          branchMap[r.branch_id] = {
            name: r.branch_name,
            total_amount: 0,
            transaction_count: 0
          };
        }
        branchMap[r.branch_id].total_amount += Number(r.amount);
        branchMap[r.branch_id].transaction_count++;
      });

      const branches = Object.values(branchMap).map((b: any) => ({
        ...b,
        percentage: total_received
          ? Number(((b.total_amount / total_received) * 100).toFixed(2))
          : 0
      }));

      const firmMap: any = {};
      rows.forEach((r: any) => {
        if (!firmMap[r.firm_id]) {
          firmMap[r.firm_id] = {
            name: r.firm_name,
            total_amount: 0,
            transaction_count: 0
          };
        }
        firmMap[r.firm_id].total_amount += Number(r.amount);
        firmMap[r.firm_id].transaction_count++;
      });

      const firms = Object.values(firmMap).map((f: any) => ({
        ...f,
        percentage: total_received
          ? Number(((f.total_amount / total_received) * 100).toFixed(2))
          : 0
      }));

      const transactions = rows.map((r: any) => ({
        id: r.id,
        party_name: r.party_name,
        flow: r.flow,
        type: r.type,
        method_name: r.method_name,
        amount: Number(r.amount),
        date: r.date,
        reference: r.transaction_reference || "",
        note: r.invoice || ""
      }));

      return {
        summary: {
          total_received,
          total_transactions,
          top_method
        },
        methods,
        branches: level === "company" ? branches : [],
        firms: level === "branch" ? firms : [],
        transactions
      };
    });
  }
}