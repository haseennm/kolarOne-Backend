export interface CreateLedgerTransactionBody {
  category_id: number;
  amount: number;
  transaction_date: string;
  reference_id: string;
  entity_type: string;
  entity_id: number;
  company_id: number;
  status: string;
  created_by: string;
}
export interface CreateLedgerTransactionParams
  extends Omit<CreateLedgerTransactionBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}


export interface FetchLedgerTransactionBody {
  id?: number;
  company_id: number;
  from_date?: string;
  to_date?: string;
  entity_id?: string;
  entity_type?: string;
  category_id?: number;
  status?: number;
  page: number;
  limit: number;
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