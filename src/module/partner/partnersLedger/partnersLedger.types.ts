export const LEDGER_TYPE_MAP = {
  Capital: "C",
  Drawing: "D",
  Settlement: "S",
} as const;

export type FlowType = typeof LEDGER_TYPE_MAP[LedgerKey];
export type LedgerKey = keyof typeof LEDGER_TYPE_MAP;

export interface CreateCapitalLedgerBody {
  partner_id: string;
  amount: number;
  entity_type: string;
  entity_id: number
  description?: string;
  status: string;
  created_by: string;
  flow_type: LedgerKey
}

export interface CreateCapitalLedgerParams extends Omit<CreateCapitalLedgerBody, "created_by" | "status" | "flow_type"> {
  flow_type: FlowType; // "C", "D", or "S"
  remark: object;
  statusCode: number;
}

export interface EditCapitalLedgerBody {
  id: string;
  amount?: number;
  description?: string;
  status?: string;
  updated_by: string;
  entity_type: string;
  entity_id: number
}
export interface EditCapitalLedgerParams extends Omit<EditCapitalLedgerBody, "updated_by" | "status"> {
  remark: object;
  statusCode?: number;
}

export interface DeleteCapitalLedgerBody {
  id: string;
  deleted_by: string;
  entity_id: number
}

export interface DeleteCapitalLedgerParams extends Omit<DeleteCapitalLedgerBody, "deleted_by"> {
  remark: object;
}

export interface FetchLedgerRequest {
  partner_id?: string;
  entity_id?: number;
  entity_type?: string;
  flow_type?: "CAPITAL" | "DRAWING" | "SETTLEMENT";
  group_type?: "INCOME" | "EXPENSE";
  page?: number;
  limit?: number;
}

export type GroupType = "INCOME" | "EXPENSE";

export interface FetchCapitalLedgerFilters {
  partner_id?: string;
  entity_id?: number;
  entity_type?: string;
  flow_type?: FlowType;
  group_type?: GroupType;
  page?: number;
  limit?: number;
}

export interface CapitalLedgerEntry {
  id: number;
  partner_id: string;
  entity_id: number;
  entity_type: string;
  amount: number;
  flow_type: FlowType;
  description: string;
  remarks: string[];
  status: number;
  created_at: Date;
}

export interface PaginatedCapitalLedger {
  rows: CapitalLedgerEntry[];
  total: number;
  page: number;
  limit: number;
}