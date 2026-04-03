export interface CreateCustomerBody {
  company_id: number;
  customer_type: "B2B" | "B2C" | "both";

  customer_name: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;

  email?: string | null;
  phone_number: string;
  alternate_phone?: string | null;

  billing_address?: string | null;
  billing_district?: string | null;
  billing_state?: string | null;
  billing_pin?: number | null;

  shipping_address?: string | null;
  shipping_district?: string | null;
  shipping_state?: string | null;
  shipping_pin?: number | null;

  state_code?: string | null;

  gstin?: string | null;

  notes?: string[];

  status: string;
  created_by: string;
}

export interface CreateCustomerParams
  extends Omit<CreateCustomerBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}

export interface FetchCustomerBody {
  page?: number;
  limit?: number;
  id?: string;
  company_id?: number;
  search?: string | null;
  customer_type?: "B2B" | "B2C" | "both";
  status?: number;
}

export interface FetchCustomerParams {
  offset: number;
  filters: FetchCustomerBody;
}

export interface FetchDbCustomer
  extends Omit<CreateCustomerBody, "status" | "created_by"> {
  id: string;
  status: number;
  remarks: object | null;
}

export type CountResult = {
  count: string;
};

export interface EditCustomerBody {
  id: string;
  company_id: number;
  customer_type?: "B2B" | "B2C" | "both";
  customer_name?: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  email?: string | null;
  phone_number?: string | null;
  alternate_phone?: string | null;
  billing_address?: string | null;
  billing_district?: string | null;
  billing_state?: string | null;
  billing_pin?: number | null;
  shipping_address?: string | null;
  shipping_district?: string | null;
  shipping_state?: string | null;
  shipping_pin?: number | null;
  state_code?: string | null;
  gstin?: string | null;
  notes?: string[];
  status?: string | null;
  updated_by: string;
}

export interface EditCustomerParams
  extends Omit<EditCustomerBody, "updated_by" | "status" | "remarks"> {
  remark: object;
  statusCode: number | undefined;
}

export interface DeleteCustomerBody {
  r_id: string;
  company_id: number;
  deleted_by: string;
}

export interface DeleteCustomerParams
  extends Omit<DeleteCustomerBody, "deleted_by"> {
  remark: object;
  company_id: number;
}
export interface GetCustomerReport {
  level: "firm" | "branch" | "company";
  firm_id?: number;
  branch_id?: number;
  company_id?: number;
  start_date?: string;
  end_date?: string;
}