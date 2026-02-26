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
  email?: string | null;
  website?: string | null;
  logo?: string | null;
}
export interface CreateCompanyParams
  extends Omit<CreateCompanyBody, "created_by" | "status"> {
  remark: string
  statusCode: number
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
export interface getDbCompany  extends Omit<CreateCompanyBody,  "status">{
  id : number,
  status:number
}

export type CountResult = {
  count: string  
}