
export interface CreateSaleRetunItemBody {
  sale_return_id: number;
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
  sale_item_id: number;
  return_mode: "to_stock" | "to_damage"
}
export interface CreateSaleReturnItemParams
  extends Omit<CreateSaleRetunItemBody, "status"> {
  statusCode: number;
  remark: object;
}

export interface EditSaleRetunItemBody {
  item_id: number;
  sale_return_id: number;
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
  sale_item_id?: number;
  return_mode?: "to_stock" | "to_damage";
}

export interface EditSaleReturnItemParams
  extends Omit<EditSaleRetunItemBody, "status"> {
  statusCode?: number;
  remark: object;
}

export interface FetchSaleReturnItemFilters {
  id?: number;
  purchase_id?: number;
  firm_id?: number;
  branch_id?: number;
  page: number;
  limit: number;
}
export interface FetchSaleReturnItemParams {
  offset: number;
  filters: FetchSaleReturnItemFilters;
}
export type SaleReturnItemCountResult = {
  count: string;
};
export interface FetchDbSaleReturnItem {
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

export interface DeleteSaleReturnItemBody {
  sale_return_id: number;
  firm_id: number;
}
export interface DeleteSaleReturnItemParams
  extends DeleteSaleReturnItemBody {
  remark: object;
}

export interface UpdateSaleReturnItemParams {
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

export interface UpdateSaleReturnItemBody {
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