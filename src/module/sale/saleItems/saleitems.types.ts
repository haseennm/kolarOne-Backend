
export interface CreateSaleItemBody {
  sale_id: number;
  firm_id: number;
  // branch_id: number;
  status: string;
  product_id: number;
  stock_id: number;
  saled_qty: number;
  unit: string;
  unit_price: number;
  sub_total: number;
  discount: number;
  net_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  final_amount: number;
}
export interface CreateSaleItemParams
  extends Omit<CreateSaleItemBody, "status"> {
  statusCode: number;
  remark: object;
}
export interface EditSaleItemBody {
  item_id: number
  sale_id: number;
  firm_id: number;
  branch_id: number;
  status?: string;
  product_id?: number;
  stock_id?: number;
  saled_qty: number;
  discount?: number;
  unit?: string;
  unit_price?: number;
  sub_total?: number;
  total_igst?: number;
  total_sgst?: number;
  total_cgst?: number;
  net_amount?: number;
  final_amount?: number;
}
export interface EditSaleItemParams
  extends Omit<EditSaleItemBody, "status"> {
  statusCode?: number;
  remark: object;
}

export interface FetchSaleItemFilters {
  id?: number;
  sale_id?: number;
  firm_id?: number;
  branch_id?: number;
  page: number;
  limit: number;
}
export interface FetchSaleItemParams {
  offset: number;
  filters: FetchSaleItemFilters;
}
export type SaleItemCountResult = {
  count: string;
};
export interface FetchDbSaleItem {
  id: number;
  Sale_id: number;
  product_id: number;
  stock_id: number;

  Saled_qty: number;
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

export interface DeleteSaleItemBody {
  sale_id: number;
  firm_id: number;
}
export interface DeleteSaleItemParams
  extends DeleteSaleItemBody {
  remark: object;
}

export interface UpdateSaleItemParams {
  id: number;
  branch_id: number;
  firm_id: number;
  Saled_qty?: number;
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

export interface UpdateSaleItemBody {
  Saled_qty?: number;
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