export interface EntityItem {
  entity_id: number;
  entity_type: "Branch" | "Firm" | "Company";
  profit_share: number;
}

export interface CreateProfitShareBody {
  partner_id: string; // UUID
  entities: EntityItem[];
  created_by: string;
}

export interface CreateProfitShareParams {
  remark: object;
  partner_id: string; // UUID
  statusCode: number;
  entity_id: number;
  entity_type:string;
  profit_share: number;
}

export interface FetchProfitShareBody {
  page?: number;
  limit?: number;
  partner_id?: string;
  entity_id?: number;
  entity_type?: string;
}

export interface EditProfitShareBulkBody {
  updated_by: string;
  entities: EditProfitShareItem[];
}

export interface EditProfitShareItem {
  id: number;
  entity_id: number;
  entity_type: "Branch" | "Firm" | "Company";
  profit_share?: number;
  status?: "Active" | "Inactive";
}
export interface EditProfitShareParams {
  id: number;
  entity_id: number;
  entity_type: string;
  profit_share?: number;
  statusCode?: number;
  remark: {
    action: string;
    updated_by: string;
    updated_at: number;
  };
}
export interface ProfitShareFilters {
  partner_id?: number;
  partner_name?: string;
  profit_share_gt?: number;
  profit_share_lt?: number;
  page?: number;
  limit?: number;
}

export interface ProfitShareRow extends Omit<CreateProfitShareBody, "created_by" | "status"> {
  status: number;
  id: number
}
export interface DeletePartnerProfitBody {
  id: string;
  entity_id: number;
  deleted_by: string;
}

export interface DeletePartnerProfitParams extends Omit<DeletePartnerProfitBody, "deleted_by"> {
  remark: object;
}