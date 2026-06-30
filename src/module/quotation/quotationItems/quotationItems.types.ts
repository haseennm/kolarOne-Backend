
export interface CreateQuotationItemBody {
  quotation_id: number;
  firm_id: number;
  // branch_id: number;
  status: string;
  product_id: number;
  stock_id: number;
  quotation_qty: number;
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
export interface CreateQuotationItemParams
  extends Omit<CreateQuotationItemBody, "status"> {
  statusCode: number;
  remark: object;
}
export interface EditQuotationItemBody {
  item_id: number
  quotation_id: number;
  firm_id: number;
  branch_id: number;
  status?: string;
  product_id?: number;
  stock_id?: number;
  quotation_qty: number;
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
export interface EditQuotationItemParams
  extends Omit<EditQuotationItemBody, "status"> {
  statusCode?: number;
  remark: object;
}

export interface FetchQuotationItemFilters {
  id?: number;
  quotation_id?: number;
  firm_id?: number;
  branch_id?: number;
  page: number;
  limit: number;
}
export interface FetchQuotationItemParams {
  offset: number;
  filters: FetchQuotationItemFilters;
}
export type QuotationItemCountResult = {
  count: string;
};
export interface FetchDbQuotationItem {
  id: number;
  quotation_id: number;
  product_id: number;
  stock_id: number;

  quotation_qty: number;
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

export interface DeleteQuotationItemBody {
  quotation_id: number;
  firm_id: number;
}
export interface DeleteQuotationItemParams
  extends DeleteQuotationItemBody {
  remark: object;
}

export interface UpdateQuotationItemParams {
  id: number;
  branch_id: number;
  firm_id: number;
  quotation_qty?: number;
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

export interface UpdateQuotationItemBody {
  quotation_qty?: number;
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
export interface ChangeQuotationItemStatus{
  quotation_id:number;
  status:number;
  firm_id:number;
  remark:object;
}