export interface CreatePaymentMethodBody {
  name: string;
  company_id: number;
  status: string;
  created_by: string;
  note?: string
}
export interface CreatePaymentMethodParams
  extends Omit<CreatePaymentMethodBody, "status"> {
  statusCode: number;
}


export interface FetchPaymentMethodBody {
  id?: number;
  company_id: number;
  search?: string | null;
  status?: number;
  page: number;
  limit: number;
}
export interface FetchPaymentMethodParams {
  offset: number;
  filters: FetchPaymentMethodBody;
}
export interface FetchDbPaymentMethod
  extends Omit<CreatePaymentMethodBody, "status" | "created_by"> {
  id: string;
  status: number;
}

export type CountResult = {
  count: string;
};

export interface EditPaymentMethodBody {
  id: number;
  company_id: number;
  updated_by: string;
  name?: string;
  note?: string;
  status?: number;
}
export interface EditPaymentMethodParams
  extends Omit<EditPaymentMethodBody, "status"> {
  statusCode: number;
}
export interface DeletePaymentMethodBody {
  r_id: number;
  company_id: number;
  deleted_by: string;
}