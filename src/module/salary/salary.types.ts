export interface GenerateSalaryBody {
  from_date: string;        // YYYY-MM-DD
  to_date: string;          // YYYY-MM-DD
  month_salary: string;     // YYYY-MM (will be normalized to YYYY-MM-01)
  branch_id: number;        // ← changed from client_id
  created_by: string;
  staff_ids: string[];      // array of staff IDs
}

export interface CreateSalaryParams
  extends Omit<GenerateSalaryBody, "created_by" | "month_salary"> {
  remark: object;
  salaryMonthStr: string
}
export interface SalaryGenerationRow {
  staff_id: string;
  salary_month: string;
  base_salary: number;
  total_days: number;
  full_days: number;
  half_days: number;
  holiday_days: number;
  absent_days: number;
  payable_days: number;
  gross_salary: number;
  final_salary: number;
  branch_id: number;
  // created_by: string;
  remarks: any;             // JSON array
  status: string;
  full_name: string;        // from join
}

export interface GenerateSalaryResponse {
  status: "Success";
  data: SalaryGenerationRow[];
}

export interface ConfirmSalary {
  r_id: string;
  branch_id: number;
  final_salary: number;
  updated_by: string;
  status: string;
  payment_method_id?:number;
  transaction_reference?:string;
}
export interface ConfirmSalaryParams
  extends Omit<ConfirmSalary, "status"|"updated_by"> {
  statusCode: number;
  remark:object;
}