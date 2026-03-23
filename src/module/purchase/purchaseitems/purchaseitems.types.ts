
export interface CreatePurchaseItemBody {
  purchase_id: number;
  firm_id: number;
  branch_id: number;
  status: string;
  product_id: number;
  stock_id: number;
  received_qty: number;
  purchased_qty: number;
  unit: string;
  unit_price: number;
  sub_total: number;
  total_igst: number;
  total_sgst: number;
  total_cgst: number;
  net_amount: number;
}
export interface CreatePurchaseItemParams
  extends Omit<CreatePurchaseItemBody, "status"> {
  statusCode: number;
  remark: object;
}
export interface EditPurchaseItemBody {
  item_id: number
  purchase_id: number;
  firm_id: number;
  branch_id: number;
  status?: string;
  product_id?: number;
  stock_id?: number;
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
export interface EditPurchaseItemParams
  extends Omit<EditPurchaseItemBody, "status"> {
  statusCode?: number;
  remark: object;
}

export interface FetchPurchaseItemFilters {
  id?: number;
  purchase_id?: number;
  firm_id?: number;
  branch_id?: number;
  page: number;
  limit: number;
}
export interface FetchPurchaseItemParams {
  offset: number;
  filters: FetchPurchaseItemFilters;
}
export type PurchaseItemCountResult = {
  count: string;
};
export interface FetchDbPurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  stock_id: number;

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

  // joined fields
  product_name: string;
  bill_number: string;
  batch_number: string | null;
}

export interface DeletePurchaseItemBody {
  purchase_id: number;
  firm_id: number;
}
export interface DeletePurchaseItemParams
  extends DeletePurchaseItemBody {
  remark: object;
}

export interface UpdatePurchaseItemParams {
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
  stock_id?: number | null;
  updated_by: number;
}

export interface UpdatePurchaseItemBody {
  purchased_qty?: number;
  received_qty?: number;
  unit?: string;
  unit_price?: number;
  sub_total?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  net_amount?: number;
  stock_id?: number | null;
  updated_by: number;
}