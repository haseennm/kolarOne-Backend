
export interface CreatePurchaseRetunItemBody {
  purchase_return_id: number;
  firm_id: number;
  branch_id: number;
  status: string;
  product_id: number;
  stock_id?: number;
  returned_qty: number;
  unit: string;
  unit_price: number;
  sub_total: number;
  total_igst: number;
  total_sgst: number;
  total_cgst: number;
  net_amount: number;
  purchase_item_id:number
}
export interface CreatePurchaseReturnItemParams
  extends Omit<CreatePurchaseRetunItemBody, "status"> {
  statusCode: number;
  remark: object;
}
export interface EditPurchaseReturnItemBody {
  return_item_id: number
  purchase_return_id: number;
  firm_id: number;
  branch_id: number;
  status?: string;
  product_id?: number;
  stock_id?: number;
  returned_qty: number;
  unit?: string;
  unit_price?: number;
  sub_total?: number;
  total_igst?: number;
  total_sgst?: number;
  total_cgst?: number;
  net_amount?: number;
  purchase_item_id:number
}
export interface EditPurchaseReturnItemParams
  extends Omit<EditPurchaseReturnItemBody, "status"> {
  statusCode?: number;
  remark: object;
}

export interface FetchPurchaseReturnItemFilters {
  id?: number;
  purchase_id?: number;
  firm_id?: number;
  branch_id?: number;
  page: number;
  limit: number;
}
export interface FetchPurchaseReturnItemParams {
  offset: number;
  filters: FetchPurchaseReturnItemFilters;
}
export type PurchaseReturnItemCountResult = {
  count: string;
};
export interface FetchDbPurchaseReturnItem {
  id: number;
  purchase_Return_id: number;
  product_id: number;
  stock_id: number;

  returned_qty: number;

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

export interface DeletePurchaseReturnItemBody {
  purchase_id: number;
  firm_id: number;
}
export interface DeletePurchaseReturnItemParams
  extends DeletePurchaseReturnItemBody {
  remark: object;
}

export interface UpdatePurchaseReturnItemParams {
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

export interface UpdatePurchaseReturnItemBody {
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