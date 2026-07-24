export interface CreateVendorBody {
  company_id: number;
  firm_id?: number[];
  vendor_name: string;
  email?: string | null;
  phone_number: string | null;
  alternate_phone?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  state_code?: string | null;
  status: string;
  supply_type?: string | null;
  gst_treatment?: string | null;
  remark?: string | null;
  bank_acc_holder?: string | null;
  bank_acc_number?: string | null;
  ifsc?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;
  currency?: string | null;
  payment_terms?: string | null;
  opening_balance?: string | null;
  created_by?: string | null;

  // Not present in the schema, but included if your API expects it
  branch_id?: number;
}

export interface CreateVendorParams
  extends Omit<CreateVendorBody, "created_by" | "status" | "remark"> {
  remark: object;
  statusCode: number;
}

export interface FetchVendorBody {
  page?: number;
  limit?: number;

  id?: string;
  gstin?: string;
  firm_id?: number;
  company_id?: number;

  search?: string | null;
  status?: number;
}

export interface FetchVendorParams {
  offset: number;
  filters: FetchVendorBody;
}

export interface FetchDbVendor
  extends Omit<CreateVendorBody, "status" | "created_by" | "branch_id"> {
  id: string;
  status: number;
  remarks: object | null;
  firm_names: string[];
}

export type CountResult = {
  count: string;
};

export interface EditVendorBody {
  id: string;
  company_id: number;
  firm_id?: number[];

  vendor_name?: string;
  email?: string | null;
  phone_number?: string | null;
  alternate_phone?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;

  gstin?: string | null;
  pan?: string | null;
  state_code?: string | null;

  status?: string;

  supply_type?: string | null;
  gst_treatment?: string | null;
  remark?: string | null;

  bank_acc_holder?: string | null;
  bank_acc_number?: string | null;
  ifsc?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;

  currency?: string | null;
  payment_terms?: string | null;
  opening_balance?: string | null;

  branch_id?: number;

  updated_by: string;
}

export interface EditVendorParams
  extends Omit<EditVendorBody, "updated_by" | "status" | "remark"> {
  remark: object;
  statusCode?: number;
}

export interface AddNewFirm {
  vendor_id: string;
  firm_id: number;
  company_id: number;
  firm_name: string;
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
export interface RemoveFirmVendor {
  r_id: string;
  firm_id: number;
  company_id:number
  firm_name:string
}

export interface RemoveFirmVendorParams
  extends RemoveFirmVendor {
  remark: object;
}

export type GetVendorReportBody = {
  level: "firm" | "branch" | "company";
  firm_id?: number;
  branch_id?: number;
  company_id?: number;
  start_date?: string;
  end_date?: string;
};