import { CreateAssetPurchaseItemBody, EditAssetPurchaseItemBody, UpdateAssetPurchaseItemParams } from "../assetPurchaseitems/assetPurchaseItems.types";
interface PaymentObj {
  payment_amount: number;
  transaction_reference?: string | null;
  payment_method_id: number;
}
export interface AssetPurchaseCreateBody {
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
  firm_id?: number;
  branch_id?: number
  company_id: number
  payments: PaymentObj[]
  items: CreateAssetPurchaseItemBody[];
  courier_charge?: number
  other_charge?: number
  handling_charge?: number
}
export interface AssetPurchaseCreateParams
  extends Omit<AssetPurchaseCreateBody, "status" | "created_by" | "items" | "payments"> {
  remark: object;
  paid_amount: number; // Aggregate total payment amount
  payments: string;    // Stringified JSON breakdown for the database column
}

export interface AssetPurchasePaymentEditItem {
  id?: number | null;
  payment_method_id: number;
  amount: number;
  transaction_reference?: string | null;
  payment_flow: "I" | "E"
}
interface AssetPurchaseItemEditBody extends EditAssetPurchaseItemBody{
  is_new:boolean
   warranty_expiry?: string;
  identification_number?: string;
  serial_number?: string
}
export interface AssetPurchaseEditBody {
  asset_purchase_id: number;
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
  payments?: AssetPurchasePaymentEditItem[]; // Group payment inputs
  items?: AssetPurchaseItemEditBody[];
  delete_item_ids?: number[];
  courier_charge?: number;
  other_charge?: number;
  handling_charge?: number;
}

export interface AssetPurchaseEditParams
  extends Omit<AssetPurchaseEditBody, "status" | "updated_by" | "items" | "delete_item_ids" | "payments"> {
  statusCode?: number;
  remark: object;
  computed_payment_amount: number;
  merged_payments_json: string;
}

export interface AssetPurchaseFetchBody {
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
export type AssetPurchaseFullFetchBody = Omit<AssetPurchaseFetchBody, 'id'> & {
  id: number;
};
export interface AssetPurchaseFullFetchParams {
  offset: number;
  filters: AssetPurchaseFullFetchBody; // ✅ id is required here
}

export interface AssetPurchaseFetchParams {
  offset: number;
  filters: AssetPurchaseFetchBody; // normal optional id
}

export interface AssetPurchaseDeleteBody {
  id: number;
  company_id: number;
  branch_id?: number;
  firm_id?: number;
  deleted_by: string
}
export type AssetPurchaseDeleteParams = Omit<AssetPurchaseDeleteBody, 'deleted_by'> & {
  remark: object;
};

interface ObjPayment {
  payment_method_id: number,
  payment_amount: number;
  transaction_reference: string | null
}
export interface RepayBalanceAssetPurchase {
  asset_purchase_id: number,
  payments: ObjPayment[],
  remark: any,
  company_id: number
  payment_flow: "exp" | "inc"
}
