import { PoolClient } from "pg";

export interface AssetStockCreateBody {
  firm_id?: number;
  branch_id?: number;
  company_id: number
  asset_purchase_id: number | null;
  asset_product_id: number;
  available_qty: number;
  purchased_qty: number;
  status: 'Damaged' | 'Good';
  warranty_expiry?: string;
  identification_number?: string;
  serial_number?: string
}
export interface AssetStockCreateParams extends Omit<AssetStockCreateBody, "status"> {
  statusCode: number
}
export interface AssetStockEditBody {
  asset_stock_id: number
  company_id: number
  branch_id?: number;
  firm_id?: number;
  asset_purchase_id: number | null;
  asset_product_id?: number;
  available_qty?: number;
  purchased_qty?: number;
  status?: 'Damaged' | 'Good';
  warranty_expiry?: string;
  identification_number?: string;
  serial_number?: string
}
export interface AssetStockEditParams extends Omit<AssetStockEditBody, "status"> {
  statusCode?: number
}
export interface AssetStockChangeBody {
  stock_id: number
  branch_id: number;
  firm_id: number;
  qty: number;
  movement_type?: 'I' | 'O';
  reason: string;
  is_relate_purchase: boolean;
  return_mode?: "to_stock" | "to_damage";
}

export interface AssetStockChangeParams extends AssetStockChangeBody {
  statusCode?: number
}
export interface AssetStockFetchBody {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
  quantity?: number;
  id?: string;
  firm_id?: number;
  branch_id?: number;
  company_id: number;
  barcode: string;
  product_id: number;
  available_qty_min: number;
  available_qty_max: number;
  purchased_qty_min: number;
  purchased_qty_max: number;

  search?: string | null;
  status?: number;
}

export interface FetchPopup {
  branch_id: number;
  stock_id?: number;
  product_id?: number;
}
export interface AssetStockAdjustFetchBody {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
  id?: string;
  firm_id?: number;
  branch_id?: number;
  company_id: number;
  barcode: string;
  product_id: number;
  quantity: number;
  search?: string | null;
  status?: number;
  flow_type?: string
}

export interface AssetStockFetchParams {
  offset: number;
  filters: AssetStockFetchBody;
}
export interface AssetStockAdjustFetchParams {
  offset: number;
  filters: AssetStockAdjustFetchBody;
}
export interface AssetStockDelete {
  asset_purchase_id?: number;
  company_id: number;
  asset_stock_id?: number;
}
export interface AssetStockReport {
  level: "firm" | "branch" | "company";
  firm_id?: number;
  branch_id?: number;
  company_id?: number;
}

export interface AssetStockPriceSet {
  firm_id: number;
  r_id: number;
  mrp_price: number;
  wholesale_price: number;
  retail_price: number;
  branch_price: number;
  special_retail_price: number
}
export interface AssetStockAdditionalBody {
  firm_id: number;
  branch_id: number;
  product_id: number;
  insert_batch_number?: number;
  qty: number;
  status: 'Damaged' | 'Good';
  company_id: number
}
export interface AssetStockAdditionalParams extends Omit<AssetStockAdditionalBody, "status"> {
  statusCode: number,
  reason: string
}
export interface AssetStockQtyChangeBody {
  r_id: number;
  branch_id: number;
  company_id: number;
  available_qty: number;
  note: string;
}
export interface InsertAssetStockParams {
  client: PoolClient
  qty: number;
  branch_id: number;
  firm_id: number;
  product_id: number;
  statusCode: number;
  batch_number: string;
  barcode: string;
}