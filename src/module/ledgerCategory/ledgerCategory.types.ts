export interface CreateLedgerCategoryBody {
  category_type: "E" | "I";
  name: string;
  company_id: number;
  status: string;
  created_by: string;
}
export interface CreateLedgerCategoryParams
  extends Omit<CreateLedgerCategoryBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}


export interface FetchLedgerCategoryBody {
  id?: number;
  company_id: number;
  search?: string | null;
  category_type?: number; 
  status?: number;
  page: number;
  limit: number;
}
export interface FetchLedgerCategoryParams {
  offset: number;
  filters: FetchLedgerCategoryBody;
}
export interface FetchDbLedgerCategory
  extends Omit<CreateLedgerCategoryBody, "status" | "created_by"> {
  id: string;
  status: number; 
  remarks: object | null;
}

export interface EditLedgerCategoryBody {
  id: number;
  company_id: number;
  updated_by: string;
  category_type?: "E" | "I";
  name?: string;
  status?: number;
  remarks?: object;
}
export type CountResult = {
  count: string;
};

export interface EditLedgerCategoryParams
  extends Omit<EditLedgerCategoryBody, "updated_by" | "status"> {
  remark: object;
  statusCode: number;
}
export interface DeleteLedgerCategoryBody {
  r_id: number;
  company_id: number;
  deleted_by: string;
}

export interface DeleteLedgerCategoryParams
  extends Omit<DeleteLedgerCategoryBody, "deleted_by"> {
  remark: object;
  company_id: number;
}