import { CreatePurchaseItemBody, EditPurchaseItemBody } from "../purchaseitems/purchaseitems.types";

export interface PurchaseCreateBody {
  vendor_id: string;
  bill_number: string;
  bill_date: Date | string;
  subtotal: number;
  discount: number;
  net_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  final_amount: number;
  payment_amount: number;
  notes?: string | null;
  status?: string;
  created_by: string;
  firm_id: number;
  branch_id: number
  company_id: number
  transaction_reference?: string | null;
  payment_method_id: number;
  items: CreatePurchaseItemBody[];
}
export interface PurchaseCreateParams
  extends Omit<PurchaseCreateBody, "status" | "created_by" | "items"> {
  statusCode: number;
  remark: object
}
export interface PurchaseEditBody {
  purchase_id: number
  updated_by: string;
  firm_id: number;
  branch_id: number
  company_id: number
  vendor_id?: string;
  bill_number?: string;
  bill_date?: Date | string;
  subtotal?: number;
  discount?: number;
  net_amount?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  final_amount?: number;
  payment_amount?: number;
  notes?: string | null;
  status?: string;
  transaction_reference?: string | null;
  payment_method_id?: number;
  items?: EditPurchaseItemBody[];
}
export interface PurchaseEditParams
  extends Omit<PurchaseEditBody, "status" | "updated_by" | "items"> {
  statusCode?: number;
  remark: object
}



export interface PurchaseFetchBody {
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
export type PurchaseFullFetchBody = Omit<PurchaseFetchBody, 'id'> & {
  id: number;
};
export interface PurchaseFullFetchParams {
  offset: number;
  filters: PurchaseFullFetchBody; // ✅ id is required here
}

export interface PurchaseFetchParams {
  offset: number;
  filters: PurchaseFetchBody; // normal optional id
}

export interface PurchaseDeleteBody {
  id: number;
  firm_id: number;
  deleted_by: string
}
export type PurchaseDeleteParams = Omit<PurchaseDeleteBody, 'deleted_by'> & {
  remark: object;
};
export interface RepayBalancePurchase {
  purchase_id: number,
  firm_id: number,
  remark: object,
  payment_amount: number
}