export interface CreateAssetProductBody {
  brand_name: number | null;
  name: string;
  description: string | null;
  unit: string | null;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  status: "Active" | "Inactive" | "Deleted";
  image: string | null;
  company_id: number;
  created_by: string;
}

export interface CreateAssetProductParams
  extends Omit<CreateAssetProductBody, "created_by"> {
  remarks: object;
}

export interface FetchAssetProductBody {
  page?: number;
  limit?: number;
  id?: number;
  company_id: number;
  search?: string | null;
  status?: number;
}

export interface FetchAssetProductParams {
  offset: number;
  filters: FetchAssetProductBody;
}

export interface AssetProduct {
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


export interface EditAssetProductBody {
  id: number;
  company_id: number;
  asset_brand?: number | null;
  asset_name?: string;
  short_name?: string | null;
  description?: string | null;
  barcode?: string | null;
  hsn_sac_code?: string | null;
  unit?: string | null;
  cgst_rate?: number | null;
  sgst_rate?: number | null;
  igst_rate?: number | null;
  status?: 0 | 1 | 2;
  image?: string | null;
  updated_by:string
}
export interface EditAssetProductParams
  extends Omit<EditAssetProductBody, "updated_by" | "status"> {
  remarks: object;
  statusCode: number | undefined;
}

export interface DeleteAssetProductBody {
  r_id: number;
  company_id: number;
  deleted_by: string;
}

export interface GetAssetProductReport{
    level: "firm" | "branch" | "company";
    firm_id?: number;
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
}
export interface DeleteAssetProductParams
  extends Omit<DeleteAssetProductBody, "deleted_by"> {
  remarks: object;
  company_id: number;
}
