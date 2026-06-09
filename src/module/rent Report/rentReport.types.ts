// report.types.ts

export interface RentReportInput {
  company_id: number;
  branch_id?: number;
  level: "company" | "branch";
  cashflow?: "income" | "expense";
}

export interface RentReportItem {
  id: string;
  ref_no: string;
  branch_id: string;
  branch_name?: string;
  amount: number;
  payment_method_id: string;
  row_type: "bill" | "advance" | "loss";
  row_id: string;
  cash_flow: "in" | "out";
  note: string | null;
  remarks: any;
  status: number;
  created_at: Date;
  details: {
    customer_name?: string;
    customer_id?: string;
    bill_number?: string;
    product_id?: string;
    quantity?: number;
    responsible_type?: string;
    payment_status?: number;
  } | null;
}

export interface TimePeriodSummary {
  income: number;
  expense: number;
  net: number;
}

export interface RentBranchSummary {
  branch_id: string;
  branch_name: string;
  total_income: number;
  total_expense: number;
  net_amount: number;
  transaction_count: number;
  // Time breakdown summaries per branch
  today_summary: TimePeriodSummary;
  month_summary: TimePeriodSummary;
  year_summary: TimePeriodSummary;
}

export interface RentReportResponse {
  summary: {
    total_income: number;
    total_expense: number;
    net_amount: number;
    // Global time breakdown summaries
    today_summary: TimePeriodSummary;
    month_summary: TimePeriodSummary;
    year_summary: TimePeriodSummary;
  };
  data: RentReportItem[];
  branch_wise?: RentBranchSummary[];
}

export interface ProductReportInput {
  company_id: number;
  branch_id?: number;
  level: "company" | "branch";
}

export interface ProductTimeSummary {
  units_rented: number;
  revenue: number;
}

export interface ProductReportItem {
  product_id: string;
  product_name: string;
  stock_type: string;
  hourly_rate: number;
  daily_rate: number;
  total_units_rented: number;
  total_units_returned: number;
  total_units_lost: number;
  total_revenue: number;
  total_loss_penalty_charged: number;
  total_loss_collected: number;
  today: ProductTimeSummary;
  this_month: ProductTimeSummary;
  this_year: ProductTimeSummary;
}

export interface ProductBranchSummary {
  branch_id: string;
  branch_name: string;
  total_units_rented: number;
  total_revenue: number;
  today_summary: ProductTimeSummary;
  month_summary: ProductTimeSummary;
  year_summary: ProductTimeSummary;
  products: {
    product_id: string;
    product_name: string;
    units_rented: number;
    revenue: number;
  }[];
}

export interface RentReportFilterInput {
  company_id: number;
  branch_id?: number;
  level: "company" | "branch";
}

// 1. Return Items structures
export interface ReturnReportItem {
  bill_id: string;
  bill_number: string;
  customer_name: string;
  branch_name: string;
  product_name: string;
  quantity_taken: number;
  returned_qty: number;
  rate_per_item: number;
  actual_close_date: Date | null;
}

// 2. Damage / Missing structures
export interface DamageMissingReportItem {
  loss_id: string;
  product_name: string;
  branch_name: string;
  responsible_type: "customer" | "branch";
  customer_name: string | null;
  quantity_lost: number;
  loss_type: "Damaged" | "Missing";
  penalty_amount: number;
  paid_amount: number;
  payment_status_text: "Paid" | "Unpaid" | "Partial";
  created_at: Date;
}

// 3. Overday / Overdue structures
export interface OverdayReportItem {
  bill_id: string;
  bill_number: string;
  customer_name: string;
  customer_phone: string | null;
  branch_name: string;
  product_name: string;
  quantity_taken: number;
  expected_return_date: Date;
  days_overdue: number;
}

export const sharedSchemaBody = {
    type: "object",
    required: ["level", "company_id"],
    properties: {
      company_id: { type: "number" },
      branch_id: { type: "number" },
      level: { type: "string", enum: ["company", "branch"] }
    }
  };
  export type DashboardBody = {
  company_id: number;
  branch_id: number;
};
  export type DailyCashFlowBody = {
    branch_id: number;
    month: number;
    year: number;
};