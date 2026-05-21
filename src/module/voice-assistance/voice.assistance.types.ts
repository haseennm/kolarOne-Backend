export interface VoiceCommandReq {
  message:string;
  entity_id: number,
  entity_type: string
}

// export interface CreateSalaryParams
//   extends Omit<GenerateSalaryBody, "created_by" | "month_salary"> {
//   remark: object;
//   salaryMonthStr: string
// }
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
  status: number;
  full_name: string;        // from join
}

export interface GetSalaryBody {
  salary_month: string;
  entity_type: string;
  entity_id: number;
  staff_ids?: string[];
}
export interface GenerateSalaryResponse {
  status: "Success";
  data: SalaryGenerationRow[];
}

export interface ConfirmSalary {
  r_id: string;
 entity_type: string;
  entity_id: number;
  final_salary: number;
  updated_by: string;
  status: string;
  payment_method_id?: number;
  transaction_reference?: string;
  company_id:number
}
export interface ConfirmSalaryParams
  extends Omit<ConfirmSalary, "status" | "updated_by"|"company_id"> {
  statusCode: number;
  remark: object;
}