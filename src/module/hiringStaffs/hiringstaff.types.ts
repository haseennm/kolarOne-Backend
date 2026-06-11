export interface CreateHireStaffBody {
  email: string;
  full_name: string;
  father_name?: string;
  spouse_name?: string;
  address?: string;
  phone_number: string;
  residence_phone?: string;
  date_of_birth?: string;
  driving_license_no?: string;
  languages_known?: string[]
  passport_no?: string;
  qualification?: string;
  technical_qualification?: string;
  previous_organization?: string;
  blood_group?: string;
  identification_mark?: string;
  working_from?: string; // "09:00"
  working_to?: string;   // "18:00"
  expected_salary?: number;
  designation?: string;
  entity_type: string;
  entity_id: number;
  company_id: number;
  branch_id?: number;
  image?: string | null //passport image
  attachments?: {
    type: string;
    url: string;
  }[];
}

export interface CreateHireStaffParams
  extends Omit<CreateHireStaffBody, "created_by"> {
  remark: object;
  entity_table: string
}
export interface FetchHireStaffBody {
  id?: string;
  company_id?: number;
  role?: string[];
  status?: string;
  branch_id?: string;
  search?: string;
  page: number;
  limit: number;
  firm_staff?:boolean
}

export interface FetchHireStaffParams {
  offset: number;
  filters: FetchHireStaffBody;
}

export interface FetchDbHireStaff
  extends Omit<CreateHireStaffBody, "password" | "status" | "created_by"> {
  id: string;
  password_hash: string;
  status: number;
  remarks: object | null;
}
export type HireStaffCountResult = {
  count: string;
};

export interface EditStatusHireStaffBody {
  id: string;
  updated_by: string;
  entity_type: string;
  entity_id: number;
  status: "Accept" | "Deny" | "Hold";
}

export interface EditStatusHireStaffParams
  extends Omit<EditStatusHireStaffBody, "updated_by"> {
  remark: object;
}

export interface DeleteHireStaffBody {
  r_id: string;
  company_id: number;
  entity_id: number;
  entity_type: number;
  deleted_by: string;
}

export interface DeleteHireStaffParams
  extends Omit<DeleteHireStaffBody, "deleted_by"> {
  remark: object;
}