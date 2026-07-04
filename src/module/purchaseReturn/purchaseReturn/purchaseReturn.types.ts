import { CreatePurchaseRetunItemBody, EditPurchaseReturnItemBody } from "../purchaseReturnItems/purchaseReturnItems.types";

// export interface PurchaseReturnCreateBody {
//   purchase_id: number
//   return_date: Date | string;
//   subtotal: number;
//   net_amount: number;
//   total_cgst: number;
//   total_sgst: number;
//   total_igst: number;
//   final_amount: number;
//   payment_amount: number;
//   reason?: string | null;
//   status?: string;
//   created_by: string;
//   firm_id: number;
//   branch_id: number
//   company_id: number
//   transaction_reference?: string | null;
//   payment_method_id: number;
//   items: CreatePurchaseRetunItemBody[];
// }
// export interface PurchaseReturnCreateParams
//   extends Omit<PurchaseReturnCreateBody, "status" | "created_by" | "items"> {
//   statusCode: number;
//   remark: object
// }
export interface PurchaseReturnPaymentItem {
  payment_method_id: number | null;
  amount: number;
  reference: string | null;
}

export interface CreatePurchaseReturnItemBody {
  product_id: number;
  stock_id: number;
  returned_qty: number;
  unit: string;
  unit_price: number;
  sub_total: number;
  total_igst?: number;
  total_sgst?: number;
  total_cgst?: number;
  net_amount: number;
  purchase_item_id: number;
}

export interface PurchaseReturnCreateBody {
  purchase_id: number;
  return_date: Date | string;
  subtotal: number;
  net_amount: number;
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
  payments: PurchaseReturnPaymentItem[]; // Accepting array collection for multiple splits
  items: CreatePurchaseReturnItemBody[];
}

export interface PurchaseReturnCreateParams
  extends Omit<PurchaseReturnCreateBody, "status" | "created_by" | "items" | "payments"> {
  statusCode: number;
  remark: object;
  payment_amount: number; // Evaluated dynamically in the Controller
  payments: string;       // Saved as stringified text layout for standard JSON arrays mapping
}
// export interface PurchaseReturnEditBody {
//   purchase_return_id: number
//   updated_by: string;
//   firm_id: number;
//   branch_id: number
//   company_id: number
//   return_date?: Date | string;
//   subtotal?: number;
//   net_amount?: number;
//   total_cgst?: number;
//   total_sgst?: number;
//   total_igst?: number;
//   final_amount?: number;
//   payment_amount?: number;
//   reason?: string | null; 
//   status?: string;
//   transaction_reference?: string | null;
//   payment_method_id?: number;
//   items?: EditPurchaseReturnItemBody[];
// }
// export interface PurchaseReturnEditParams
//   extends Omit<PurchaseReturnEditBody, "status" | "updated_by" | "items"> {
//   statusCode: number;
//   remark: object
// }
export interface PurchaseReturnEditBody {
  purchase_return_id: number;
  purchase_id?: number;
  updated_by: string;
  firm_id: number;
  branch_id: number;
  company_id: number;
  vendor_id?: string;
  return_number?: string;
  return_date?: Date | string;
  subtotal?: number;
  discount?: number;
  net_amount?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  final_amount?: number;
  notes?: string | null;
  reason?: string | null;
  status?: string;
  payments?: { id?: number | null; payment_method_id: number; amount: number; transaction_reference?: string | null }[];
  items?: any[];
  delete_item_ids?: number[];
  courier_charge?: number;
  other_charge?: number;
  handling_charge?: number;
}

export interface PurchaseReturnReturnParams
  extends Omit<PurchaseReturnEditBody, "status" | "updated_by" | "items" | "delete_item_ids" | "payments"> {
  remark: object;
  computed_payment_amount: number;
  merged_payments_json: string;
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

interface ObjPayment {
  payment_method_id: number,
  payment_amount: number;
  transaction_reference: string | null
}
export interface RepayBalancePurchaseReturn {
  purchase_return_id: number,
  firm_id: number,
  payments: ObjPayment[],
  remark: any,
  company_id: number
}