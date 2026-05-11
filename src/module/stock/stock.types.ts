export interface StockCreateBody {
  firm_id: number;
  branch_id: number;
  purchase_id: number | null;
  product_id: number;
  selling_price?: number;
  available_qty: number;
  purchased_qty: number;
  status: 'Damaged' | 'Good';
  movement_type: 'I' | 'O';
  reason: string;
  company_id: number
}
export interface StockCreateParams extends Omit<StockCreateBody, "status"> {
  statusCode: number
}
export interface StockEditBody {
  stock_id: number
  company_id: number
  branch_id: number;
  firm_id: number;
  purchase_id: number | null;
  selling_price?: number;
  product_id?: number;
  available_qty?: number;
  purchased_qty?: number;
  status?: 'Damaged' | 'Good';
  movement_type?: 'I' | 'O';
  reason?: string;
}
export interface StockEditParams extends Omit<StockEditBody, "status"> {
  statusCode?: number
}
export interface StockChangeBody {
  stock_id: number
  branch_id: number;
  firm_id: number;
  qty: number;
  movement_type?: 'I' | 'O';
  reason: string;
  is_relate_purchase: boolean;
  return_mode?: "to_stock" | "to_damage";
}

export interface StockChangeParams extends StockChangeBody {
  statusCode?: number
}
export interface  StockFetchBody {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;

  id?: string;
  firm_id?: number;
  branch_id?: number;
  company_id: number;
  barcode:string;
  product_id: number;
  available_qty_min: number;
  available_qty_max: number;
  purchased_qty_min: number;
  purchased_qty_max: number;

  search?: string | null;
  status?: number;
}

export interface StockFetchParams {
  offset: number;
  filters: StockFetchBody;
}
export interface StockDelete {
  purchase_id: number;
  firm_id: number
}
export interface StockReport {
  level: "firm" | "branch" | "company";
  firm_id?: number;
  branch_id?: number;
  company_id?: number;
}

export interface StockPriceSet {
  firm_id: number;
  r_id: number;
  selling_price: number;
}
export interface StockAdditionalBody {
  firm_id: number;
  branch_id: number;
  product_id: number;
  selling_price?: number;
  insert_batch_number?: number;
  qty: number;
  status: 'Damaged' | 'Good';
  company_id: number
}
export interface StockAdditionalParams extends Omit<StockAdditionalBody, "status"> {
  statusCode: number,
  reason:string
}