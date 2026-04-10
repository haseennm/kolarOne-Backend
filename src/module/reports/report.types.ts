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
