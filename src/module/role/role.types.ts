export interface CreateRoleBody {
  role: string;
  description?: string;

  company_id: number;

  status: string;
}
export interface CreateRoleParams
  extends Omit<CreateRoleBody, "status"> {
  statusCode: number;
}



export interface FetchRoleBody {
  id?: number;
  branch_id?: number;
  company_id: number;
  // status?: number;
  search?: string;
  page: number;
  limit: number;
}
export interface FetchRoleParams {
  offset: number;
  filters: FetchRoleBody;
}
export interface FetchDbRole {
  id: number;
  company_id: number;

  role: string;
  description?: string;

  status: number;
  remarks: object | null;
}
export type RoleCountResult = {
  count: string;
};



export interface EditRoleBody {
  id: number;
  company_id: number;
  role?: string;
  description?: string;
  status?: string;
}

export interface EditRoleParams
  extends Omit<EditRoleBody, "status"> {
  statusCode: number;
}


export interface DeleteRoleBody {
  id: number;
  company_id: number;
}