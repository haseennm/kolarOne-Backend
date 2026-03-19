import { CreatePurchaseItemBody } from "../purchaseitems/purchaseitems.types";

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
  branch_id:number
  company_id:number
  transaction_reference?: string | null;
  payment_method_id: number;
  items: CreatePurchaseItemBody[];
}
export interface PurchaseCreateParams
  extends Omit<PurchaseCreateBody, "status" |"created_by" |"items"> {
  statusCode: number;
  remark:object
}



export interface PurchaseFetchBody {
  id?: number;
  branch_id?: number;
  company_id: number;
  // status?: number;
  search?: string;
  page: number;
  limit: number;
}
export interface PurchaseFetchParams {
  offset: number;
  filters: PurchaseFetchBody;
}
export interface PurchaseFetchDb {
  id: number;
  company_id: number;

  Purchase: string;
  description?: string;

  status: number;
  remarks: object | null;
}
export type PurchaseCountResult = {
  count: string;
};



export interface PurchaseEditBody {
  id: number;
  company_id: number;
  Purchase?: string;
  description?: string;
  status?: string;
}

export interface PurchaseEditParams
  extends Omit<PurchaseEditBody, "status"> {
  statusCode: number;
}


export interface PurchaseDeleteBody {
  id: number;
  company_id: number;
}