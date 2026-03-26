import { CreateSaleRetunItemBody, EditSaleRetunItemBody } from "../saleReturnItems/saleReturnItems.types";

export interface SaleReturnCreateBody {
  sale_id: number
  return_date: Date | string;
  subtotal: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  final_amount: number;
  reason?: string | null;
  status?: string;
  created_by: string;
  firm_id: number;
  branch_id: number
  company_id: number
  transaction_reference?: string | null;
  payment_method_id: number;
  items: CreateSaleRetunItemBody[];
}
export interface SaleReturnCreateParams
  extends Omit<SaleReturnCreateBody, "status" | "created_by" | "items"> {
  statusCode: number;
  remark: object
}

export interface SaleReturnEditBody {
  sale_return_id: number;
  sale_id?: number;
  return_date?: Date | string;
  subtotal?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  final_amount?: number;
  reason?: string | null;
  status?: string;
  updated_by: string;
  firm_id: number;
  branch_id: number;
  company_id: number;
  transaction_reference?: string | null;
  payment_method_id?: number;
  items?: EditSaleRetunItemBody[];
}

export interface SaleReturnEditParams
  extends Omit<SaleReturnEditBody, "status" | "updated_by" | "items"> {
  statusCode?: number;
  remark: object;
}



export interface SaleReturnFetchBody {
  id?: number;
  firm_id?: number;
  branch_id?: number;
  company_id: number;
  search?: string;
  start_date?: string;
  end_date?: string;
  page: number;
  limit: number;
}
export type PurchaseFullFetchBody = Omit<SaleReturnFetchBody, 'id'> & {
  id: number;
};
export interface SaleReturnFullFetchParams {
  offset: number;
  filters: PurchaseFullFetchBody; // ✅ id is required here
}

export interface SaleReturnFetchParams {
  offset: number;
  filters: SaleReturnFetchBody; // normal optional id
}

export interface SaleReturnDeleteBody {
  id: number;
  firm_id: number;
  deleted_by: string
}
export type SaleReturnDeleteParams = Omit<SaleReturnDeleteBody, 'deleted_by'> & {
  remark: object;
};