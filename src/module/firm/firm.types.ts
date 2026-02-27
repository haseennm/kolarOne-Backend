export interface CreateFirmBody {
  company_id: number,
  branch_id: number;
  name_of_manager: string | null;
  phone_number: string | null;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
  status: string; // will be converted to number (1,0,-1) at service level
  remarks?: object | null;
  created_by: string;
  gstin?: string;
  pan_number?: string;
  firm_name: string;
  firm_code: string
  username: string;
  password: string
}

export interface CreateFirmParams
  extends Omit<CreateFirmBody, "created_by" | "status" | "remarks" | "password">  {
  remark: object;
  statusCode: number;
  hashed:string
}

export interface FetchFirmBody {
  page?: number;
  limit?: number;
  id?: number;
  branch_id?: number;
  search?: string | null;
  status?: number;
}

export interface FetchFirmParams {
  offset: number;
  filters: FetchFirmBody;
}

export interface FetchDbFirm
  extends Omit<CreateFirmBody, "status" | "created_by"> {
  id: number;
  status: number; // 1 = Active, 0 = Inactive, -1 = Deleted
  remarks: object | null;
}

export type CountResult = {
  count: string;
};

export interface EditFirmBody {
  id: number;
  branch_id: number;
  name_of_manager?: string | null;
  phone_number?: string | null;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
  status?: string | null;
  remarks?: object | null;
  updated_by: string;
  firm_name?: string;
  firm_code?: string
  gstin?: string | null;
  pan_number?: string | null;
}

export interface EditFirmParams
  extends Omit<EditFirmBody, "updated_by" | "status" | "remarks"> {
  remark: object;
  statusCode: number | undefined;
}

export interface DeleteFirmBody {
  r_id: number;
  branch_id: number;
  deleted_by: string;
}

export interface DeleteFirmParams
  extends Omit<DeleteFirmBody, "deleted_by"> {
  remark: object;
  branch_id: number;
}

export interface FirmLoginBody{
  password:string;
  username:string
}