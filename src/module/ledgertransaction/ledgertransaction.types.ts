export interface CreateLedgerTransactionBody {
  ledger_category_id: number;
  amount: number;
  transaction_date: string;
  transaction_time: string;
  reference_id: string;
  entity_type: string;
  entity_id: number;
  company_id: number;
  status: string;
  created_by: string;
  entry_type: "I" | "E"
}
export interface CreateLedgerTransactionParams
  extends Omit<CreateLedgerTransactionBody, "created_by" | "status" |"entry_type"> {
  remark: object;
  statusCode: number;
}


export interface FetchLedgerTransactionBody {
  id?: number;
  company_id: number;
  from_date?: string;
  to_date?: string;
  firm_id?: string;
  branch_id?: string;
  category_id?: number;
  status?: number;
  page: number;
  limit: number;
  level: "company" | "branch" | "firm"
}
export interface FetchLedgerTransactionParams {
  offset: number;
  filters: FetchLedgerTransactionBody;
}
export interface FetchDbLedgerTransaction
  extends Omit<CreateLedgerTransactionBody, "status" | "created_by"> {
  id: string;
  status: number;
  remarks: object | null;
}
export type LedgerTransactionCountResult = {
  count: string;
};

export interface EditLedgerTransactionBody {
  id: number;
  company_id: number;
  updated_by: string;
  entity_type: string;
  entity_id: number;
  category_id?: number;
  amount?: number;
  transaction_time?: string;
  transaction_date?: string;
  reference_id?: string;
  status?: number;

}

export interface EditLedgerTransactionParams
  extends Omit<EditLedgerTransactionBody, "updated_by" | "status"> {
  remark: object;
  statusCode: number;
}
export interface DeleteLedgerTransactionBody {
  r_id: number;
  company_id: number;
  entity_id: number;
  deleted_by: string;
}

export interface DeleteLedgerTransactionParams
  extends Omit<DeleteLedgerTransactionBody, "deleted_by"> {
  remark: object;
}