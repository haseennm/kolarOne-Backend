
export interface CreateAssetPurchaseItemBody {
  asset_purchase_id: number;
  firm_id?: number;
  branch_id?: number;
  company_id: number;
  status: string;
  asset_product_id: number;
  asset_stock_id: number;
  received_qty: number;
  purchased_qty: number;
  unit: string;
  unit_price: number;
  sub_total: number;
  total_igst: number;
  total_sgst: number;
  total_cgst: number;
  net_amount: number;
  warranty_expiry?: string;
  identification_number?: string;
  serial_number?: string
}
export interface CreateAssetPurchaseItemParams
  extends Omit<CreateAssetPurchaseItemBody, "status"> {
  statusCode: number;
  remark: object;
}
export interface EditAssetPurchaseItemBody {
  item_id?: number
  asset_purchase_id: number;
  firm_id: number;
  branch_id: number;
  is_new?: boolean;
  batches?: unknown[];
  status?: string;
  asset_product_id?: number;
  asset_stock_id?: number;
  received_qty?: number;
  purchased_qty?: number;
  unit?: string;
  unit_price?: number;
  sub_total?: number;
  total_igst?: number;
  total_sgst?: number;
  total_cgst?: number;
  net_amount?: number;
}
export interface EditAssetPurchaseItemParams
  extends Omit<EditAssetPurchaseItemBody, "status" | "item_id"> {
  item_id: number;
  statusCode?: number;
  remark: object;
}

export interface FetchAssetPurchaseItemFilters {
  id?: number;
  asset_purchase_id?: number;
  firm_id?: number;
  branch_id?: number;
  page: number;
  limit: number;
}
export interface FetchAssetPurchaseItemParams {
  offset: number;
  filters: FetchAssetPurchaseItemFilters;
}
export type AssetPurchaseItemCountResult = {
  count: string;
};
export interface FetchDbAssetPurchaseItem {
  id: number;
  asset_purchase_id: number;
  asset_product_id: number;
  asset_stock_id: number;

  purchased_qty: number;
  received_qty: number;

  unit: string;
  unit_price: number;

  sub_total: number;
  total_igst: number;
  total_sgst: number;
  total_cgst: number;

  net_amount: number;

  firm_id: number;
  branch_id: number;

  status: number;
  remark: object | null;

  product_name: string;
  bill_number: string;
  batch_number: string | null;
}

export interface DeleteAssetPurchaseItemBody {
  asset_purchase_id: number;
  item_id?: number;
}
export interface DeleteAssetPurchaseItemParams
  extends DeleteAssetPurchaseItemBody {
  remark: object;
}

export interface UpdateAssetPurchaseItemParams {
  id: number;
  branch_id: number;
  firm_id: number;
  purchased_qty?: number;
  received_qty?: number;
  unit?: string;
  unit_price?: number;
  sub_total?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  net_amount?: number;
  asset_stock_id?: number | null;
  updated_by: number;
}

export interface UpdateAssetPurchaseItemBody {
  purchased_qty?: number;
  received_qty?: number;
  unit?: string;
  unit_price?: number;
  sub_total?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  net_amount?: number;
  asset_stock_id?: number | null;
  updated_by: number;
}
