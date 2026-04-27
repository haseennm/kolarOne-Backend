export interface CreateBrandBody {
  name: string;
  created_by: string;
  status?: string;
  note?: string | null;
  company_id: number
}

export interface EditBrandBody {
  id: number;
  name?: string;
  status?: string;
  note?: string | null;
  updated_by: string;
  company_id: number

}

export interface DeleteBrandBody {
  id: number;
  deleted_by: string;
  company_id: number

}
export interface DeleteBrandParams {
  id: number;
  remark: object;
  company_id: number

}

export type CountResult = {
  count: string
}
export interface EditBrandParams
  extends Omit<EditBrandBody, "updated_by" | "status"> {
  remark: object,
  statusCode: number
}
export interface CreateBrandParams
  extends Omit<CreateBrandBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}

export interface Brand {
  id: number;
  company_id: number;
  remark: object | null;
  status: string;
  name: string
}
export interface BrandFilter {
  id?: number;
  company_id: number;
  search?: string | null;
  status?: number;
}
export interface FetchBrandBody {
  page?: number;
  limit?: number;
  company_id?: number;
  id?: number;
  search?: string | null;
}
export interface FetchBrandParams {
  offset: number;
  filters: FetchBrandBody;
}