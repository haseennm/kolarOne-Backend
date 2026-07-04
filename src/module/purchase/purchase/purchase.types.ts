import { CreatePurchaseItemBody, EditPurchaseItemBody } from "../purchaseitems/purchaseitems.types";
interface PaymentObj {
  payment_amount: number;
  transaction_reference?: string | null;
  payment_method_id: number;
}
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
  notes?: string | null;
  created_by: string;
  firm_id: number;
  branch_id: number
  company_id: number
  payments: PaymentObj[]
  items: CreatePurchaseItemBody[];
  courier_charge?: number
  other_charge?: number
  handling_charge?: number
}
export interface PurchaseCreateParams
  extends Omit<PurchaseCreateBody, "status" | "created_by" | "items" |"payments"> {
  remark: object; 
  paid_amount: number; // Aggregate total payment amount
  payments: string;    // Stringified JSON breakdown for the database column
}
// export interface PurchaseEditBody {
//   purchase_id: number
//   updated_by: string;
//   firm_id: number;
//   branch_id: number
//   company_id: number
//   vendor_id?: string;
//   bill_number?: string;
//   bill_date?: Date | string;
//   subtotal?: number;
//   discount?: number;
//   net_amount?: number;
//   total_cgst?: number;
//   total_sgst?: number;
//   total_igst?: number;
//   final_amount?: number;
//   payment_amount?: number;
//   notes?: string | null;
//   status?: string;
//   transaction_reference?: string | null;
//   payment_method_id?: number;
//   items?: EditPurchaseItemBody[];
//   delete_item_ids?: number[];
//   courier_charge?: number
//   other_charge?: number
//   handling_charge?: number
// }
// export interface PurchaseEditParams
//   extends Omit<PurchaseEditBody, "status" | "updated_by" | "items" | "delete_item_ids"> {
//   statusCode?: number;
//   remark: object
// }

export interface PurchasePaymentEditItem {
  id?: number | null; // ID tracking reference inside the payment_transactions table
  payment_method_id: number;
  amount: number;
  transaction_reference?: string | null;
}

export interface PurchaseEditBody {
  purchase_id: number;
  updated_by: string;
  firm_id: number;
  branch_id: number;
  company_id: number;
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
  notes?: string | null;
  status?: string;
  payments?: PurchasePaymentEditItem[]; // Group payment inputs
  items?: any[]; 
  delete_item_ids?: number[];
  courier_charge?: number;
  other_charge?: number;
  handling_charge?: number;
}

export interface PurchaseEditParams
  extends Omit<PurchaseEditBody, "status" | "updated_by" | "items" | "delete_item_ids" | "payments"> {
  statusCode?: number;
  remark: object;
  computed_payment_amount: number;
  merged_payments_json: string;
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

interface ObjPayment {
  payment_method_id: number,
  payment_amount: number;
  transaction_reference: string | null
}
export interface RepayBalancePurchase {
  purchase_id: number,
  firm_id: number,
  payments: ObjPayment[],
  remark: any,
  company_id: number
  payment_flow:"exp" |"inc"
}
