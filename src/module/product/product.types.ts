export interface CreateProductBody {
  category_id: number;
  brand_id: number | null;
  name: string;
  short_name: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  hsn_sac_code: string | null;
  unit: string | null;
  base_price: number;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  status: "Active" | "Inactive" | "Deleted";
  image: string | null;
  company_id: number;
  created_by: string;
}

export interface CreateProductParams
  extends Omit<CreateProductBody, "created_by" | "status"> {
  remarks: object;
  statusCode: number;
}

export interface FetchProductBody {
  page?: number;
  limit?: number;
  id?: number;
  company_id?: number;
  search?: string | null;
  status?: number;
}

export interface FetchProductParams {
  offset: number;
  filters: FetchProductBody;
}

export interface Product {
  id: number;

  category_id: number;
  brand_id?: number | null;

  name: string;
  short_name?: string | null;
  description?: string | null;

  sku?: string | null;
  barcode?: string | null;

  hsn_sac_code?: string | null;
  unit?: string | null;

  base_price: number;

  cgst_rate?: number | null;
  sgst_rate?: number | null;
  igst_rate?: number | null;
  status: 0 | 1 | 2; 
  remarks?: Record<string, any> | null;
  image?: string | null;

  company_id: number;
}

export type CountResult = {
  count: string;
};


export interface EditProductBody {
  id: number;
  company_id: number;
  category_id?: number;
  brand_id?: number | null;
  name?: string;
  short_name?: string | null;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  hsn_sac_code?: string | null;
  unit?: string | null;
  base_price?: number;
  cgst_rate?: number | null;
  sgst_rate?: number | null;
  igst_rate?: number | null;
  status?: 0 | 1 | 2;
  image?: string | null;
  updated_by:string
}
export interface EditProductParams
  extends Omit<EditProductBody, "updated_by" | "status"> {
  remarks: object;
  statusCode: number | undefined;
}

export interface DeleteProductBody {
  r_id: number;
  company_id: number;
  deleted_by: string;
}

export interface GetProductReport{
    level: "firm" | "branch" | "company";
    firm_id?: number;
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
}
export interface DeleteProductParams
  extends Omit<DeleteProductBody, "deleted_by"> {
  remarks: object;
  company_id: number;
}
