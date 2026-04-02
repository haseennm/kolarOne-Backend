export interface CreatePartnerBody {
  company_id: number;
  name: string;
  address: string;
  phone_number: string;
  city: string;
  district: string;
  state?: string | null;
  pincode: string;
  status: string; 
  created_by: string;
}

export interface CreatePartnerParams extends Omit<CreatePartnerBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}

export interface FetchPartnerBody {
  page?: number;
  limit?: number;
  id?: string;
  company_id?: number;
  search?: string | null;
  status?: number;
}

export interface FetchPartnerParams {
  offset: number;
  filters: FetchPartnerBody;
}

export interface EditPartnerBody {
  id: string;
  company_id: number;
  name?: string;
  address?: string;
  phone_number?: string;
  city?: string;
  district?: string;
  state?: string | null;
  pincode?: string;
  status?: string | null;
  updated_by: string;
}

export interface EditPartnerParams extends Omit<EditPartnerBody, "updated_by" | "status"> {
  remark: object;
  statusCode?: number;
}

export interface DeletePartnerBody {
  id: string;
  company_id: number;
  deleted_by: string;
}

export interface DeletePartnerParams extends Omit<DeletePartnerBody, "deleted_by"> {
  remark: object;
}