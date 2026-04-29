export interface GetReportBody {
  level: "company" | "branch" | "firm";
  company_id?: number;
  branch_id?: number;
  firm_id?: number;
  start_date: string;
  end_date: string;
}
export interface GetGSTReportBody {
  type: "GSTR-1" | "GSTR-3B";
  level: "company" | "branch" | "firm";
  firm_id?: number;
  branch_id?: number;
  company_id?: number;
  start_date?: string;
  end_date?: string;
}


export interface SalesTrendInput {
  level: "company" | "branch" | "firm";
  company_id: number;
  branch_id?: number;
  firm_id?: number;
  months?: number;
};

export type SalesForecastInput = {
  level: "company" | "branch" | "firm";
  company_id: number;
  branch_id?: number;
  firm_id?: number;
  forecast_months?: number;
};


export type OpportunityForecastInput = {
  level: "company" | "branch" | "firm";
  company_id: number;
  branch_id?: number;
  firm_id?: number;
  top_items_limit?: number;
};

export type PaymentReportInput = {
  level: "company" | "branch" | "firm";
  company_id: number;
  branch_id?: number;
  firm_id?: number;
  flow?: "in" | "out" | "all";
  method_filter?: number | null;
  start_date?: string;
  end_date?: string;
};
export type CompanyDashboardBody = {
  company_id: number;
};