export interface CreateStockRentBody {
  company_id: number;
  branch_id: number;
  product_id: number;
  is_group_item: boolean;
  total_units: number;
  unique_name: string[]
  price_hour: number;
  price_day: number;
  price_week: number;
  price_month: number;
  default_return_date: number; // day
  created_by: string | number;
  status?: string
}

export interface CreateStockRentParams
  extends Omit<CreateStockRentBody, "created_by" | "status" | "is_group_item"> {
  remark: object;
  statusCode: number;
  stock_type: string
}

export interface FetchStockRentBody {
  page?: number;
  limit?: number;
  id?: string;
  company_id?: number;
  branch_id?: number
  search?: string | null;
  status?: number;
}

export interface FetchStockRentParams {
  offset: number;
  filters: FetchStockRentBody;
}

export interface FetchDbStockRent
  extends Omit<CreateStockRentBody, "status" | "created_by"> {
  id: string;
  status: number;
  remarks: object | null;
}

export type CountResult = {
  count: string;
};

export interface EditStockRentBody {
  id: string;
  company_id: number;
  branch_id?: number;
  product_id?: number;
  total_units?: number;
  unique_name?: string[]
  price_hour?: number;
  price_day?: number;
  price_week?: number;
  price_month?: number;
  default_return_date?: number; // day
  updated_by: string | number;
  status?: string
}

export interface EditStockRentParams
  extends Omit<EditStockRentBody, "updated_by" | "status" | "remarks"> {
  remark: object;
  statusCode: number | undefined;
}

export interface DeleteStockRentBody {
  r_id: string;
  deleted_by: string;
  branch_id: number;
}

export interface DeleteStockRentParams
  extends Omit<DeleteStockRentBody, "deleted_by"> {
  remark: object;
}
export interface GetStockRentReport {
  level: "firm" | "branch" | "company";
  firm_id?: number;
  branch_id?: number;
  company_id?: number;
  start_date?: string;
  end_date?: string;
}