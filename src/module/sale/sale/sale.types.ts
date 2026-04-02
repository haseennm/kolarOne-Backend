import { CreateSaleItemBody, EditSaleItemBody } from "../saleItems/saleitems.types";
interface Payments {
  payment_method_id: number;
  amount: number;
  reference?: string
}
export interface SaleCreateBody {
  customer_id: string;
  invoice_date: Date | string;
  subtotal: number;
  discount: number;
  net_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  final_amount: number;
  paid: number;
  notes?: string | null;
  status?: string;
  created_by: string;
  firm_id: number;
  branch_id: number
  company_id: number;
  payments: Payments[]
  items: CreateSaleItemBody[];
}
export interface SaleCreateParams
  extends Omit<SaleCreateBody, "status" | "created_by" | "items"> {
  statusCode: number;
  remark: object
}
export interface SaleEditBody {
  Sale_id: number;
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
  paid?: number;
  notes?: string | null;
  status?: string;
  payments?: Payments[];
  items?: EditSaleItemBody[];
}
export interface SaleEditParams
  extends Omit<SaleEditBody, "status" | "updated_by" | "items"> {
  statusCode?: number;
  remark: object;
}



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