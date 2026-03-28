export interface CreateLoanBody {
  staff_id: string;
  loan_amount: number;
  branch_id: number;
  company_id: number;
  created_by: string
}
export interface CreateLoanParams
  extends Omit<CreateLoanBody, "status" | "created_by"> {
  statusCode: number;
  remark: object
}

export interface FetchLoanBody {
  staff_id?: string;
  id?: number
  company_id: number;
  branch_id?: number;
  loan_amount_min?: number,
  loan_amount_max?: number,

  paid_amount_min?: number,
  paid_amount_max?: number,

  balance_amount_min?: number,
  balance_amount_max?: number,

  page: number,
  limit: number
}
export interface GetReportBody {
  level: "branch" | "company";
  branch_id?: number;
  company_id?: number;
  start_date?: string;
  end_date?: string;
}
export interface FetchLoanParams {
  offset: number;
  filters: FetchLoanBody;
}
export interface FetchDbLoan extends Omit<CreateLoanBody, "status" | "created_by"> {
  id: number;
  branch_name: string;
  status: number;
  remarks: object | null;
  balance_amount: number;
  paid_amount: number
}
export type LoanCountResult = {
  count: string;
};



export interface EditLoanBody {
  id: number;
  company_id: number;
  Loan?: string;
  description?: string;
  status?: string;
}

export interface EditLoanParams
  extends Omit<EditLoanBody, "status"> {
  statusCode: number;
}
export interface RepayLoanBody {
  loan_id: number;
  company_id: number;
  branch_id: number;
  pay_amount: number
  updated_by: string
}
export interface RepayLoanParams extends Omit<RepayLoanBody, "updated_by"> {
  remarks: object;

}
export interface DeleteLoanBody {
  id: number;
  delete_by: string
  branch_id: number;
  company_id: number;
}
export interface DeleteLoanParams extends Omit<DeleteLoanBody, "delete_by"> {
  remark: object
}