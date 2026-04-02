
export interface CreateProfitShareBody {
  partner_id: string;
  entity_id: number;
  entity_type: string; 
  profit_share: number;
  status: string;
  created_by: string;
  parent_id: number;
}

export interface CreateProfitShareParams extends Omit<CreateProfitShareBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}

export interface FetchProfitShareBody {
  page?: number;
  limit?: number;
  partner_id?: string;
  entity_id?: number;
  entity_type?: string;
}

export interface EditProfitShareBody {
  id: string;
  profit_share?: number;
  status?: string;
  entity_id: number;
  entity_type: string
  updated_by: string;
}
export interface EditProfitShareParams extends Omit<EditProfitShareBody, "updated_by" | "status" | "entity_type"> {
  entity_type: string;  
  remark: object;
  statusCode?: number;
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
  id:number
}
export interface DeletePartnerProfitBody {
  id: string;
  entity_id: number;
  deleted_by: string;
}

export interface DeletePartnerProfitParams extends Omit<DeletePartnerProfitBody, "deleted_by"> {
  remark: object;
}