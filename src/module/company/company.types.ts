export interface CreateCompanyBody {
  company_name: string;
  bussiness_category: string;
  tin_number?: string | null;
  gstin: string | null;
  pan_number?: string | null;
  address: string;
  city: string;
  district: string;
  state: string;
  state_code: string;
  status: string;
  created_by: string;
  phone_number: string;
  pin_code?: number | null;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
  password:string;
  username:string
}
export interface CreateCompanyParams
  extends Omit<CreateCompanyBody, "created_by" | "status" | "password">  {
  remark: object;
  statusCode: number;
  hashed:string
}
export interface GetCompanyBody {
  page?: number
  limit?: number
  id?: number
  search?: string | null
}
export interface GetCompanyParams {
  offset: number, filters: GetCompanyBody
}
export interface getDbCompany extends Omit<CreateCompanyBody, "status"> {
  id: number,
  status: number
}

export type CountResult = {
  count: string
}

export interface EditCompanyBody {
  company_name?: string;
  bussiness_category?: string;
  tin_number?: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  id: number
  pin_code?: number
  state_code?: string;
  status: string;
  updated_by?: string;
  phone_number?: string;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
}
export interface EditCompanyParams
  extends Omit<EditCompanyBody, "updated_by" | "status"> {
  remark: object,
  statusCode: number
}

export interface DeleteCompanyBody {
  r_id: number,
  deleted_by: string
}
export interface DeleteCompanyParams
  extends Omit<DeleteCompanyBody, "deleted_by"> {
  remark: object,
}
export interface CompanyLoginBody{
  password:string;
  username:string
}