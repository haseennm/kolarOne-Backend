import { CreateQuotationItemBody, EditQuotationItemBody } from "../quotationItems/quotationItems.types";
interface Payments {
  payment_method_id: number;
  amount: number;
  reference?: string
}
export interface QuotationCreateBody {
  customer_id: string;
  invoice_date: Date | string;
  subtotal: number;
  discount: number;
  net_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  final_amount: number;
  // paid: number;
  notes?: string | null;
  created_by: string;
  firm_id: number;
  branch_id: number
  company_id: number;
  // payments: Payments[]
  items: CreateQuotationItemBody[];
  price_pool:string;
  state_code:number;
  is_intrastate:boolean
}
export interface QuotationCreateParams
  extends Omit<QuotationCreateBody, "status" | "created_by" | "items"> {
  remark: object
}
export interface QuotationEditBody {
  quotation_id: number;
  customer_id?: string;
  updated_by: string;
  firm_id: number;
  branch_id: number;
  company_id: number;
  invoice_date?: Date | string;
  subtotal?: number;
  discount?: number;
  net_amount?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  final_amount?: number;
  // paid?: number;
  notes?: string | null;
  status?: string;
  // payments?: Payments[];
  items?: EditQuotationItemBody[];
}
export interface QuotationEditParams
  extends Omit<QuotationEditBody, "status" | "updated_by" | "items"> {
  statusCode?: number;
  remark: object;
}



export interface QuotationFetchBody {
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
export type QuotationFullFetchBody = Omit<QuotationFetchBody, 'id'> & {
  id: number;
};
export interface QuotationFullFetchParams {
  offset: number;
  filters: QuotationFullFetchBody; // ✅ id is required here
}

export interface QuotationFetchParams {
  offset: number;
  filters: QuotationFetchBody; // normal optional id
}

export interface QuotationDeleteBody {
  id: number;
  firm_id: number;
  branch_id: number
  deleted_by: string
}
export type QuotationDeleteParams = Omit<QuotationDeleteBody, 'deleted_by' | 'branch_id'> & {
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
interface ObjPayment{
  payment_method_id:number,
  amount:number;
  reference_number:string | null
}
export interface RepayBalanceSale {
  Quotation_id: number,
  firm_id: number,
  payments: ObjPayment[],
  remark: any,
  company_id:number
}
export interface ChangeQuotationStatus{
  id:number;
  status:number;
  remark:object;
  firm_id:number
}