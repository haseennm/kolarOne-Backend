export interface CreateBranchBody {
  company_id: number;
  branch_code: string;
  branch_name: string;
  status: string;
  gstin: string | null;
  pan_number?: string | null;
  address: string;
  city: string;
  district: string;
  state: string;
  state_code: number;
  pincode: number;
  name_of_manager: string;
  phone_number: string;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
  created_by: string;
  password:string;
  username:string
}
export interface CreateBranchParams
  extends Omit<CreateBranchBody, "created_by" | "status" | "password">  {
  remark: object;
  statusCode: number;
  hashed:string
}
export interface FetchBranchBody {
  page?: number
  limit?: number
  id?: number
  search?: string | null
}
export interface FetchBranchParams {
  offset: number, filters: FetchBranchBody
}
export interface FetchDbBranch extends Omit<CreateBranchBody, "status"> {
  id: number,
  status: number
}

export type CountResult = {
  count: string
}

export interface EditBranchBody {
  id: number
  company_id: number;
  branch_code?: string | null;
  branch_name?: string | null;
  status?: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  state_code?: string | null;
  pincode?: number | null;
  name_of_manager?: string | null;
  phone_number?: string | null;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
  updated_by: string;
}
export interface EditBranchParams
  extends Omit<EditBranchBody, "updated_by" | "status"> {
  remark: object,
  statusCode: number | undefined
}

export interface DeleteBranchBody {
  r_id: number,
  company_id:number,
  deleted_by: string
}
export interface DeleteBranchParams
  extends Omit<DeleteBranchBody, "deleted_by"> {
  remark: object,
  company_id:number
}

export interface BranchLoginBody{
  password:string;
  username:string
}