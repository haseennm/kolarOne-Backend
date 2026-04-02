export interface CreateCompanyBrandingBody {
  logo: string;
  company_id: number,
  invoice_header: boolean;
  report_header: boolean;
  pos_print_header: boolean;
  tagline: string;
  show_address: boolean;
  primary_color: string //#FFF
  secondary_color: string //#FFF
  accent_color: string //#FFF
  show_logo: boolean;
  show_gstin: boolean;
  show_qr_upi: boolean;
  show_invoice_qr: boolean
  show_return_term: boolean
  font_size: "Small" | "Medium" | "Large";
  created_by: string;
}

export interface CreateCompanyBrandingParams
  extends Omit<CreateCompanyBrandingBody, "created_by" | "status" | "password"> {
  remark: object;
  statusCode: number
}

// export interface FetchCompanyBrandingBody {
//   page?: number;
//   limit?: number;
//   id?: number;
//   branch_id?: number;
//   search?: string | null;
//   status?: number;
// }

// export interface FetchCompanyBrandingParams {
//   offset: number;
//   filters: FetchCompanyBrandingBody;
// }

// export interface FetchDbCompanyBranding
//   extends Omit<CreateCompanyBrandingBody, "status" | "created_by"> {
//   id: number;
//   status: number; // 1 = Active, 0 = Inactive, -1 = Deleted
//   remarks: object | null;
// }

// export type CountResult = {
//   count: string;
// };

export interface EditCompanyBrandingBody {
  id: number;
  logo?: string | null;
  company_id?: number,
  invoice_header?: boolean;
  report_header?: boolean;
  pos_print_header?: boolean;
  tagline?: string;
  show_address?: boolean;
  primary_color?: string //#FFF
  secondary_color?: string //#FFF
  accent_color?: string //#FFF
  show_logo?: boolean;
  show_gstin?: boolean;
  show_qr_upi?: boolean;
  show_invoice_qr?: boolean
  show_return_term?: boolean
  font_size?: "Small" | "Medium" | "Large";
  status?: string;
  updated_by: string;
}

export interface EditCompanyBrandingParams
  extends Omit<EditCompanyBrandingBody, "updated_by" | "status" | "remarks"> {
  remark: object;
  statusCode: number | undefined;
}

export interface DeleteCompanyBrandingBody {
  company_id: number;
  deleted_by: string;
}

export interface DeleteCompanyBrandingParams
  extends Omit<DeleteCompanyBrandingBody, "deleted_by"> {
  remark: object;
  }
