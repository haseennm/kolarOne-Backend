import { CreatePurchaseRetunItemBody, EditPurchaseReturnItemBody } from "../purchaseReturnItems/purchaseReturnItems.types";

export interface PurchaseReturnCreateBody {
  purchase_id: number
  return_date: Date | string;
  subtotal: number;
  net_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  final_amount: number;
  payment_amount: number;
  reason?: string | null;
  status?: string;
  created_by: string;
  firm_id: number;
  branch_id: number
  company_id: number
  transaction_reference?: string | null;
  payment_method_id: number;
  items: CreatePurchaseRetunItemBody[];
}
export interface PurchaseReturnCreateParams
  extends Omit<PurchaseReturnCreateBody, "status" | "created_by" | "items"> {
  statusCode: number;
  remark: object
}
export interface PurchaseReturnEditBody {
  purchase_return_id: number
  updated_by: string;
  firm_id: number;
  branch_id: number
  company_id: number
  return_date?: Date | string;
  subtotal?: number;
  net_amount?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  final_amount?: number;
  payment_amount?: number;
  reason?: string | null; 
  status?: string;
  transaction_reference?: string | null;
  payment_method_id?: number;
  items?: EditPurchaseReturnItemBody[];
}
export interface PurchaseReturnEditParams
  extends Omit<PurchaseReturnEditBody, "status" | "updated_by" | "items"> {
  statusCode: number;
  remark: object
}



export interface PurchaseReturnFetchBody {
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
export type PurchaseFullFetchBody = Omit<PurchaseReturnFetchBody, 'id'> & {
  id: number;
};
export interface PurchaseReturnFullFetchParams {
  offset: number;
  filters: PurchaseFullFetchBody; // ✅ id is required here
}

export interface PurchaseReturnFetchParams {
  offset: number;
  filters: PurchaseReturnFetchBody; // normal optional id
}

export interface PurchaseReturnDeleteBody {
  id: number;
  firm_id: number;
  deleted_by: string
}
export type PurchaseReturnDeleteParams = Omit<PurchaseReturnDeleteBody, 'deleted_by'> & {
  remark: object;
};