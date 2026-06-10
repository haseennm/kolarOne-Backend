export interface CreateProductCatBody {
  name: string;
  parent_id: number | null;
  description: string | null;
  image: string | null;
  status: string;
  created_by: string;
  company_id: number;
  note?: string | null;
}

export interface CreateProductCatParams
extends Omit<CreateProductCatBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}

export interface FetchProductCatBody {
  page?: number;
  limit?: number;
  id?: number;
  company_id?: number;
  search?: string | null;
  status?: number;
  parent_id?: number;
}

export interface FetchProductCatParams {
  offset: number;
  filters: FetchProductCatBody;
}

export interface DbProductCategory {
  id: number;
  name: string;
  parent_id: number | null;
  company_id: number | null;
  description: string | null;
  note: string | null;
  image: string | null;
  status: number;
  remarks: string | null;
  branch_id?: number;
  
  parent_name?: string | null;
  company_name?: string | null;
}

export type CountResult = {
  count: string;
};


export interface EditProductCatBody {
  id: number;
  company_id: number;
  name?: string | null;
  parent_id?: number | null;
  description?: string | null;
  image?: string | null;
  updated_by: string;
  status?: string | null;
  note?: object | null;
}
export interface EditProductCatParams
  extends Omit<EditProductCatBody, "updated_by" | "status" | "remarks"> {
  remark: object;
  statusCode: number | undefined;
}

export interface DeleteProductCatBody {
  r_id: number;
  company_id: number;
  deleted_by: string;
}

export interface DeleteProductCatParams
  extends Omit<DeleteProductCatBody, "deleted_by"> {
  remark: object;
  company_id: number;
  sub_cat_remark:object
}

export interface ProductCatLoginBody {
  password: string;
  username: string
}