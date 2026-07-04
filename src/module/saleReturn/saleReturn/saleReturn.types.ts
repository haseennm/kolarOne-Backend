import { CreateSaleRetunItemBody, EditSaleRetunItemBody } from "../saleReturnItems/saleReturnItems.types";

export interface SaleReturnCreateBody {
  sale_id: number;
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
  branch_id: number;
  company_id: number;
  // ✅ Accepts multiple payments during creation
  payments?: { payment_method_id: number; amount: number; transaction_reference?: string | null }[];
  items: CreateSaleRetunItemBody[];
}

export interface SaleReturnCreateParams
  extends Omit<SaleReturnCreateBody, "status" | "created_by" | "items" | "payments"> {
  remark: object;
  computed_payment_amount: number;
  merged_payments_json: string;
}
export interface SaleReturnEditBody {
  sale_return_id: number;
  sale_id?: number;
  updated_by: string;
  firm_id: number;
  branch_id: number;
  company_id: number;
  return_date?: Date | string;
  subtotal?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  final_amount?: number;
  reason?: string | null;
  status?: string;
  payments?: { id?: number | null; payment_method_id: number; amount: number; transaction_reference?: string | null }[];
  items?: any[];//EditSaleRetunItemBody
  delete_item_ids?: number[];
}

export interface SaleReturnEditParams
  extends Omit<SaleReturnEditBody, "status" | "updated_by" | "items" | "delete_item_ids" | "payments"> {
  remark: object;
  computed_payment_amount: number;
  merged_payments_json: string;
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
  branch_id: number
  deleted_by: string
}
export type SaleReturnDeleteParams = Omit<SaleReturnDeleteBody, 'deleted_by' | 'branch_id'> & {
  remark: object;
};
interface ObjPayment {
  payment_method_id: number,
  payment_amount: number;
  transaction_reference: string | null
}
export interface RepayBalanceSaleReturn {
  sale_return_id: number,
  firm_id: number,
  payments: ObjPayment[],
  remark: any,
  company_id: number
}