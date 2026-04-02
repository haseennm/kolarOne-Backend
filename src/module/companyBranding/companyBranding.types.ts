export interface CreateCompanyBrandingBody {
  logo: string;
  company_id: number,
  invoice_header: boolean;
  report_header: boolean;
  pos_print_header: boolean;
  tagline: string;
  show_address: boolean;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
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

export interface EditCompanyBrandingBody {
  id: number;
  logo?: string | null;
  company_id?: number,
  invoice_header?: boolean;
  report_header?: boolean;
  pos_print_header?: boolean;
  tagline?: string;
  show_address?: boolean;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
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
