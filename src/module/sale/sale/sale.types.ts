import { CreateSaleItemBody, EditSaleItemBody } from "../saleItems/saleitems.types";
export interface SalePaymentItem {
  payment_method_id: number ;
  amount: number;
  reference: string | null;
}
export interface SaleProductItem {
  product_id: number;
  stock_id: number;
  saled_qty: number;
  unit: string;
  unit_price: number;
  sub_total: number;
  discount?: number;     // Optional, defaults to 0
  total_igst?: number;   // Optional, defaults to 0
  total_sgst?: number;   // Optional, defaults to 0
  total_cgst?: number;   // Optional, defaults to 0
  net_amount: number;
  final_amount: number | null;
}

export interface ActionRemark {
  action: string;
  created_by: string;
  created_at: Date;
}

export type PricePoolType = 
  | 'branch_price' 
  | 'mrp_price' 
  | 'retail_price' 
  | 'special_retail_price' 
  | 'wholesale_price';

export type SaleStatusType = 'Completed' | 'Confirm' | 'Cancelled';

// ==========================================
// 2. Controller Input Body Interface (Router Payload)
// ==========================================

export interface SaleCreateBody {
  firm_id: number;
  branch_id: number;
  company_id: number;
  created_by: string;
  customer_id: string; // UUID format string
  invoice_date: string; // "YYYY-MM-DD" date string
  subtotal: number;
  discount: number;
  net_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  courier_charge?: number;
  other_charge?: number;
  handling_charge?: number;
  final_amount: number;
  quotation_id: number | null;
  state_code: number;
  is_intrastate: boolean;
  notes: string | null;
  status?: SaleStatusType;
  price_pool: PricePoolType;
  payments: SalePaymentItem[];
  items: SaleProductItem[];
}

// ==========================================
// 3. Service Layer Parameter Interface
// ==========================================

export interface SaleCreateParams extends Omit<SaleCreateBody, 'items' | 'payments'|'created_by' | 'quotation_id'> {
  paid: number;          // Evaluated/Calculated dynamically in controller
  payments: string;      // Expected as serialized string for raw JSON/JSONB insertion
  remark: ActionRemark;  // Structured tracking log object
}
// export interface SaleEditBody {
//   Sale_id: number;
//   customer_id?: string;
//   updated_by: string;
//   firm_id: number;
//   branch_id: number;
//   company_id: number;
//   invoice_date?: Date | string;
//   subtotal?: number;
//   discount?: number;
//   net_amount?: number;
//   total_cgst?: number;
//   total_sgst?: number;
//   total_igst?: number;
//   final_amount?: number;
//   paid?: number;
//   notes?: string | null;
//   status?: string;
//   payments?: SalePaymentItem[];
//   items?: EditSaleItemBody[];
//   courier_charge?: number
//   other_charge?: number
//   handling_charge?: number
// }
// export interface SaleEditParams
//   extends Omit<SaleEditBody, "status" | "updated_by" | "items"> {
//   statusCode?: number;
//   remark: object;
// }



export interface SaleFetchBody {
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
export type SaleFullFetchBody = Omit<SaleFetchBody, 'id'> & {
  id: number;
};
export interface SaleFullFetchParams {
  offset: number;
  filters: SaleFullFetchBody; // ✅ id is required here
}

export interface SaleFetchParams {
  offset: number;
  filters: SaleFetchBody; // normal optional id
}

export interface SaleDeleteBody {
  id: number;
  firm_id: number;
  branch_id: number
  deleted_by: string
}
export type SaleDeleteParams = Omit<SaleDeleteBody, 'deleted_by' | 'branch_id'> & {
  remark: object;
};
export interface GetReportSalePurchaseLedger {
  level: string;
  firm_id?: number;
  branch_id?: number;
  company_id: number;
  start_date: string;
  end_date: string;
}
interface ObjPayment {
  payment_method_id: number,
  payment_amount: number;
  transaction_reference: string | null
}
export interface RepayBalanceSale {
  sale_id: number,
  firm_id: number,
  payments: ObjPayment[],
  remark: any,
  company_id: number
}
export interface SaleEditBody {
  sale_id: number;
  updated_by: string;
  firm_id: number;
  branch_id: number;
  company_id: number;
  customer_id?: string;
  invoice_number?: string;
  invoice_date?: Date | string;
  subtotal?: number;
  discount?: number;
  net_amount?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  final_amount?: number;
  notes?: string | null;
  status?: string;
  payments?: { id?: number | null; payment_method_id: number; amount: number; transaction_reference?: string | null }[];
  items?: any[]; 
  delete_item_ids?: number[];
  ref_no?: string | null;
  price_pool?: string | null;
  is_intrastate?: boolean;
  state_code?: string | null;
  courier_charge?: number;
  other_charge?: number;
  handling_charge?: number;
}

export interface SaleEditParams
  extends Omit<SaleEditBody, "status" | "updated_by" | "items" | "delete_item_ids" | "payments"> {
  remark: object;
  computed_payment_amount: number;
  merged_payments_json: string;
}