export interface GetProfitLossBody {
  level: "company" | "branch" | "firm";
  company_id?: number;
  branch_id?: number;
  firm_id?: number;
  start_date: string;
  end_date: string;
}