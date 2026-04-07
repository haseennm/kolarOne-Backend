import { PoolClient } from "pg";

export interface CreatePartyBalanceBody {
  ref_id: number;
  ref_type: 'S' | 'P' | 'SR' | 'PR'
  created_by: string;
  balance: number;
  flow: "I" | "O";
  firm_id: number;
}
export interface CreatePartyBalanceParams
extends Omit<CreatePartyBalanceBody, "created_by"> {
  statusCode: number;
  remark: object
}


export interface FetchPartyBalanceBody {
  firm_id?: string;
  company_id: number;
  branch_id?: number;
  id?: number;
  balance_amount_min?: number,
  balance_amount_max?: number,
  page: number,
  limit: number
}
export interface FetchPartyBalanceParams {
  offset: number;
  filters: FetchPartyBalanceBody;
}
export interface FetchDbPartyBalance extends Omit<CreatePartyBalanceBody, "created_by"> {
  id: number;
  party_name: string;
  status: number;
  remarks: object | null;
  paid: number
}
export type PartyBalanceCountResult = {
  count: string;
};



export interface EditPartyBalanceBody {
  ref_id: number;
  balance?: number;
  flow?: "I" | "O";
  firm_id: number;
  status?: string;
  ref_type: 'S' | 'P' | 'SR' | 'PR';
  action_by: string;
}

export interface EditPartyBalanceParams
  extends Omit<EditPartyBalanceBody, "status"> {
  statusCode?: number;
}
interface ObjPayment{
  payment_method_id:number,
  amount:number;
  reference_number:string | null
}
export interface RepayPartyBalanceBody {
  payment_amount: number;
  ref_id: number;
  ref_type: string;
  firm_id: number;
  pay_amount: number
  updated_by: string;
  payment_method_id: number;
  transaction_reference: string;
  company_id: number;
  payments:ObjPayment[]
}
export interface RepayPartyBalanceParams extends Omit<RepayPartyBalanceBody,"payment_amount"| "updated_by" | "payment_method_id" | "transaction_reference" | "company_id"> {
  remarks: object;

}
export interface DeletePartyBalanceBody {
  purchase_id: number;
  delete_by: string;
  firm_id: number;
}
export interface DeletePartyBalanceParams extends Omit<DeletePartyBalanceBody, "delete_by"> {
  remark: object
}