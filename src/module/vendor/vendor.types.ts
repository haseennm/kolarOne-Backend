export interface CreateVendorBody {
  company_id: number;
  branch_id: number;
  vendor_name: string;
  email?: string | null;
  phone_number?: string | null;
  alternate_phone?: string | null;
  address?: string | null;
  gstin: string | null;
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
  gstin?: string;
  branch_id?: number;
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
  branch_names: string[];
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

export interface AddNewBranch {
  vendor_id: string;
  branch_id: number;
  branch_name: string;
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
export interface RemoveBranchVendor {
  r_id: string;
  branch_id: number;
  company_id:number
  branch_name:string
}

export interface RemoveBranchVendorParams
  extends RemoveBranchVendor {
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