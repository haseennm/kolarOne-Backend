export interface CreateStaffBody {
  role: number[];
  email: string;
  password: string;

  full_name: string;

  address?: string;
  phone_number: string;
  status: string;
  entity_type: string;
  entity_id: number;
  company_id: number;

  finger_id: string;
  salary?: number;
  created_by: string;
  branch_id?:number
}

export interface CreateStaffParams
  extends Omit<CreateStaffBody, "password" | "status" | "created_by"> {
  password_hash: string;
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

  role?: string;

  full_name?: string;

  address?: string;
  phone_number?: string;

  entity_type?: string;
  entity_id?: number;

  finger_id?: string;
  salary?: number;

  status?: number;
  updated_by: string;
}

export interface EditStaffParams
  extends Omit<EditStaffBody, "status" | "updated_by"> {
  remark: object;
  statusCode: number;
  entity_table:string;
}

export interface DeleteStaffBody {
  r_id: string;
  company_id: number;
  entity_id: number;
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