export type TodaySnapdealEntityType = "C" | "B" | "F";

export interface TodaySnapdealRequest {
  entity_id: number;
  entity_type: TodaySnapdealEntityType;
}

export interface TodaySnapdealIncomeBreakdown {
  sales: number;
  purchase_return: number;
  balance_income: number;
  ledger_income: number;
  loan_income: number;
}

export interface TodaySnapdealExpenseBreakdown {
  sale_return: number;
  purchase: number;
  balance_expense: number;
  ledger_expense: number;
  loan_expense: number;
}

export interface TodaySnapdealResponseData {
  total_income: number;
  total_expense: number;
  net_amount: number;
  income_breakdown: TodaySnapdealIncomeBreakdown;
  expense_breakdown: TodaySnapdealExpenseBreakdown;
}
