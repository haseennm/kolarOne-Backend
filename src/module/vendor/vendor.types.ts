export interface CreateVendorBody {
  company_id: number;

  vendor_name: string;
  email?: string | null;
  phone_number?: string | null;
  alternate_phone?: string | null;
  address?: string | null;

  gstin?: string | null;
  pan?: string | null;
  state_code?: string | null;

  status: string;
  created_by: string;
}

export interface CreateVendorParams
  extends Omit<CreateVendorBody, "created_by" | "status"> {
  remark: object;
  statusCode: number;
}

export interface FetchVendorBody {
  page?: number;
  limit?: number;

  id?: string;
  company_id?: number;

  search?: string | null;
  status?: number;
}

export interface FetchVendorParams {
  offset: number;
  filters: FetchVendorBody;
}

export interface FetchDbVendor
  extends Omit<CreateVendorBody, "status" | "created_by"> {
  id: string;
  status: number;
  remarks: object | null;
}

export type CountResult = {
  count: string;
};

export interface EditVendorBody {
  id: string;
  company_id: number;
  vendor_name?: string;
  email?: string | null;
  phone_number?: string | null;
  alternate_phone?: string | null;
  address?: string | null;

  gstin?: string | null;
  pan?: string | null;
  state_code?: string | null;

  status?: string | null;

  remarks?: object | null;

  updated_by: string;
}

export interface EditVendorParams
  extends Omit<EditVendorBody, "updated_by" | "status" | "remarks"> {
  remark: object;
  statusCode?: number;
}

export interface DeleteVendorBody {
  r_id: string;
  company_id: number;
  deleted_by: string;
}

export interface DeleteVendorParams
  extends Omit<DeleteVendorBody, "deleted_by"> {
  remark: object;
}