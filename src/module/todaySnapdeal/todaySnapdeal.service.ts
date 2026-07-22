import { query } from "../../config/db";
import { AppError } from "../../utils/AppError";
import {
  TodaySnapdealEntityType,
  TodaySnapdealRequest,
  TodaySnapdealResponseData,
} from "./todaySnapdeal.types";

interface BusinessScope {
  companyIds: number[];
  branchIds: number[];
  firmIds: number[];
}

interface TotalRow {
  total: number | string | null;
}

interface LedgerRow {
  total: number | string | null;
  category_type: string;
}

interface BalanceRow {
  total: number | string | null;
  flow: string;
}

export default class TodaySnapdealService {
  async getTodayFinancialSnapshot(
    request: TodaySnapdealRequest
  ): Promise<TodaySnapdealResponseData> {
    const entity_id = Number(request.entity_id);

    const entity_type = String(request.entity_type).toUpperCase() as TodaySnapdealEntityType;

    if (!entity_id || Number.isNaN(entity_id)) {
      throw new AppError("Invalid entity_id", 400);
    }

    if (!["C", "B", "F"].includes(entity_type)) {
      throw new AppError(
        "Invalid entity_type. Allowed values: C, B, F",
        400
      );
    }

    const scope = await this.resolveBusinessScope(
      entity_type,
      entity_id
    );

    const [
      salesIncome,
      saleReturnExpense,
      purchaseExpense,
      purchaseReturnIncome,
      balanceTotals,
      ledgerTotals,
      loanTotal
    ] = await Promise.all([
      this.getTodaySalesTotal(scope),
      this.getTodaySaleReturnTotal(scope),
      this.getTodayPurchaseTotal(scope),
      this.getTodayPurchaseReturnTotal(scope),
      this.getTodayBalanceTotal(scope),
      this.getTodayLedgerTotal(scope),
      this.getTodayLoanTotal(scope),
    ]);

    const total_income =
      salesIncome +
      purchaseReturnIncome +
      balanceTotals.income +
      loanTotal.income +
      ledgerTotals.income;

    const total_expense =
      saleReturnExpense +
      purchaseExpense +
      balanceTotals.expense +
      loanTotal.expense +
      ledgerTotals.expense;

    return {
      total_income,
      total_expense,
      net_amount: total_income - total_expense,

      income_breakdown: {
        sales: salesIncome,
        purchase_return: purchaseReturnIncome,
        balance_income: balanceTotals.income,
        ledger_income: ledgerTotals.income,
        loan_income: loanTotal.income,
      },

      expense_breakdown: {
        sale_return: saleReturnExpense,
        purchase: purchaseExpense,
        balance_expense: balanceTotals.expense,
        ledger_expense: ledgerTotals.expense,
        loan_expense: loanTotal.expense,
      },
    };
  }

  // =========================================================
  // SALES -> INCOME
  // =========================================================

  private async getTodaySalesTotal(
    scope: BusinessScope
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(pt.amount), 0) AS total
      FROM payment_transactions pt
      WHERE pt.ref_type = 'SL'
        AND pt.status = 5
        AND DATE(pt.created_at) = CURRENT_DATE
        AND ${this.buildBusinessCondition()}
    `;

    const rows = await query<TotalRow>(sql, [
      scope.companyIds,
      scope.branchIds,
      scope.firmIds,
    ]);

    return Number(rows[0]?.total || 0);
  }

  // =========================================================
  // SALE RETURN -> EXPENSE
  // =========================================================

  private async getTodaySaleReturnTotal(
    scope: BusinessScope
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(pt.amount), 0) AS total
      FROM payment_transactions pt
      WHERE pt.ref_type = 'SR'
        AND pt.status = 5
        AND DATE(pt.created_at) = CURRENT_DATE
        AND ${this.buildBusinessCondition()}
    `;

    const rows = await query<TotalRow>(sql, [
      scope.companyIds,
      scope.branchIds,
      scope.firmIds,
    ]);

    return Number(rows[0]?.total || 0);
  }

  // =========================================================
  // PURCHASE -> EXPENSE
  // =========================================================

  private async getTodayPurchaseTotal(
    scope: BusinessScope
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(pt.amount), 0) AS total
      FROM payment_transactions pt
      WHERE pt.ref_type = 'PS'
        AND pt.status = 5
        AND DATE(pt.created_at) = CURRENT_DATE
        AND ${this.buildBusinessCondition()}
    `;

    const rows = await query<TotalRow>(sql, [
      scope.companyIds,
      scope.branchIds,
      scope.firmIds,
    ]);

    return Number(rows[0]?.total || 0);
  }

  // =========================================================
  // PURCHASE RETURN -> INCOME
  // =========================================================

  private async getTodayLoanTotal(
    scope: BusinessScope
  ): Promise<{ income: number; expense: number }> {
    const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN pt.ref_type = 'LR' THEN pt.amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN pt.ref_type = 'LN' THEN pt.amount ELSE 0 END), 0) AS expense
    FROM payment_transactions pt
    WHERE pt.ref_type IN ('LN', 'LR')
      AND pt.status = 5
      AND DATE(pt.created_at) = CURRENT_DATE
      AND ${this.buildBusinessCondition()}
  `;

    const [row] = await query<{ income: string | number; expense: string | number }>(
      sql,
      [
        scope.companyIds,
        scope.branchIds,
        scope.firmIds,
      ]
    );

    return {
      income: Number(row?.income ?? 0),
      expense: Number(row?.expense ?? 0),
    };
  }
  private async getTodayPurchaseReturnTotal(
    scope: BusinessScope
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(pt.amount), 0) AS total
      FROM payment_transactions pt
      WHERE pt.ref_type = 'PR'
        AND pt.status = 5
        AND DATE(pt.created_at) = CURRENT_DATE
        AND ${this.buildBusinessCondition()}
    `;

    const rows = await query<TotalRow>(sql, [
      scope.companyIds,
      scope.branchIds,
      scope.firmIds,
    ]);
    return Number(rows[0]?.total || 0);
  }

  // =========================================================
  // PARTY BALANCE
  // =========================================================

  private async getTodayBalanceTotal(
    scope: BusinessScope
  ): Promise<{ income: number; expense: number }> {
    const sql = `
      SELECT
        COALESCE(SUM(pt.amount), 0) AS total,
        pb.flow
      FROM payment_transactions pt
      JOIN party_balance pb
        ON pb.id = pt.ref_id
      WHERE pt.ref_type = 'BL'
        AND pt.status = 5
        AND DATE(pt.created_at) = CURRENT_DATE
        AND ${this.buildBusinessCondition()}
      GROUP BY pb.flow
    `;

    const rows = await query<BalanceRow>(sql, [
      scope.companyIds,
      scope.branchIds,
      scope.firmIds,
    ]);

    let income = 0;
    let expense = 0;

    for (const row of rows) {
      if (row.flow === "I") {
        income += Number(row.total || 0);
      }

      if (row.flow === "O") {
        expense += Number(row.total || 0);
      }
    }

    return {
      income,
      expense,
    };
  }

  // =========================================================
  // LEDGER TRANSACTION
  // =========================================================

  private async getTodayLedgerTotal(
    scope: BusinessScope
  ): Promise<{ income: number; expense: number }> {
    const sql = `
      SELECT
        COALESCE(SUM(pt.amount), 0) AS total,
        lc.category_type
      FROM payment_transactions pt
      JOIN ledger_transactions lt
        ON lt.id = pt.ref_id
      JOIN ledger_categories lc
        ON lc.id = lt.ledger_category_id
      WHERE pt.ref_type = 'LT'
        AND pt.status = 5
        AND DATE(pt.created_at) = CURRENT_DATE
        AND ${this.buildBusinessCondition()}
      GROUP BY lc.category_type
    `;

    const rows = await query<LedgerRow>(sql, [
      scope.companyIds,
      scope.branchIds,
      scope.firmIds,
    ]);

    let income = 0;
    let expense = 0;

    for (const row of rows) {
      if (row.category_type === "I") {
        income += Number(row.total || 0);
      }

      if (row.category_type === "E") {
        expense += Number(row.total || 0);
      }
    }

    return {
      income,
      expense,
    };
  }

  // =========================================================
  // BUSINESS SCOPE
  // =========================================================

  private async resolveBusinessScope(
    entityType: TodaySnapdealEntityType,
    entityId: number
  ): Promise<BusinessScope> {
    // ==========================
    // FIRM
    // ==========================

    if (entityType === "F") {
      return {
        companyIds: [],
        branchIds: [],
        firmIds: [entityId],
      };
    }

    // ==========================
    // BRANCH
    // ==========================

    if (entityType === "B") {
      const firmRows = await query<{ id: number }>(
        `
          SELECT id
          FROM firm
          WHERE branch_id = $1
            AND status != 0
        `,
        [entityId]
      );

      return {
        companyIds: [],
        branchIds: [entityId],
        firmIds: firmRows.map((row) => row.id),
      };
    }

    // ==========================
    // COMPANY
    // ==========================

    const branchRows = await query<{ id: number }>(
      `
        SELECT id
        FROM branches
        WHERE company_id = $1
          AND status != 0
      `,
      [entityId]
    );

    const branchIds = branchRows.map((row) => row.id);

    let firmIds: number[] = [];

    if (branchIds.length > 0) {
      const firmRows = await query<{ id: number }>(
        `
          SELECT id
          FROM firm
          WHERE branch_id = ANY($1::int[])
            AND status != 0
        `,
        [branchIds]
      );

      firmIds = firmRows.map((row) => row.id);
    }

    return {
      companyIds: [entityId],
      branchIds,
      firmIds,
    };
  }

  // =========================================================
  // BUSINESS FILTER CONDITION
  // =========================================================

  private buildBusinessCondition(): string {
    return `
      (
        (
          array_length($1::int[], 1) IS NOT NULL
          AND pt.business_ref = 'C'
          AND pt.business_id = ANY($1::int[])
        )

        OR

        (
          array_length($2::int[], 1) IS NOT NULL
          AND pt.business_ref = 'B'
          AND pt.business_id = ANY($2::int[])
        )

        OR

        (
          array_length($3::int[], 1) IS NOT NULL
          AND pt.business_ref = 'F'
          AND pt.business_id = ANY($3::int[])
        )
      )
    `;
  }
}