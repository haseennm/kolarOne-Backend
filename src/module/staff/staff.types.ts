export interface CreateStaffBody {
  role?: number[];
  email: string;
  password?: string;
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
  salary?: number;
  previous_organization?: string;
  blood_group?: string;
  identification_mark?: string;
  working_from?: string; // "09:00"
  working_to?: string;   // "18:00"
  expected_salary?: number;
  designation?: string;
  status?: "Active" | "Inactive";
  entity_type: string;
  entity_id: number;
  company_id: number;
  branch_id?: number;
  finger_id?: string;
  created_by: string;
  image?: string | null //passport image
  attachments?: {
    type: string;
    url: string;
  }[];
}

export interface CreateStaffParams
  extends Omit<CreateStaffBody, "password" | "status" | "created_by"> {
  password_hash?: string;
  remark: object;
  statusCode: number;
  entity_table: string
}
export interface FetchStaffBody {
  id?: string;
  company_id: number;
  role?: string[];
  status?: number;
  entity_type?: string;
  entity_id?: number;
  search?: string;
  page: number;
  limit: number;
  firm_staff?:boolean
}

export interface FetchStaffParams {
  offset: number;
  filters: FetchStaffBody;
}

export interface FetchDbStaff
  extends Omit<CreateStaffBody, "password" | "status" | "created_by"> {
  id: string;
  password_hash: string;
  status: number;
  remarks: object | null;
}
export type StaffCountResult = {
  count: string;
};

export interface EditStaffBody {
  id: string;
  company_id: number;
  updated_by: string;
  entity_type: string;
  entity_id: number;
  role?: number[];
  full_name?: string;
  father_name?: string;
  spouse_name?: string;
  address?: string;
  phone_number?: string;
  residence_phone?: string;
  designation?: string;
  previous_organization?: string;
  salary?: number;
  expected_salary?: number;
  finger_id?: string;
  blood_group?: string;
  identification_mark?: string;
  driving_license_no?: string;
  passport_no?: string;
  qualification?: string;
  technical_qualification?: string;
  working_from?: string;
  working_to?: string;
  date_of_birth?: string;
  languages_known?: string[];
  image?: string;

  attachments?: {
    type: string;
    url: string;
  }[];

  status?: "active" | "inactive" | "terminated";
}

export interface EditStaffParams
  extends Omit<EditStaffBody, "status" | "updated_by"> {
  remark: object;
  statusCode: number | undefined;
}

export interface DeleteStaffBody {
  r_id: string;
  company_id: number;
  entity_id: number;
  entity_type: number;
  deleted_by: string;
}

export interface DeleteStaffParams
  extends Omit<DeleteStaffBody, "deleted_by"> {
  remark: object;
}

export interface StaffLoginBody {
  email: string;
  password: string;
}