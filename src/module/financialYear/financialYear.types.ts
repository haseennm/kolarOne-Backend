export interface CreateFinancialYearBody {
  from_date: string | Date,
  end_date: string | Date,
  created_by: string,
  entity_type: "Company" | "Branch" | "Firm",
  entity_id: number
  status: string;
  company_id:number
}
export interface CreateFinancialYearParams
  extends Omit<CreateFinancialYearBody, "status" | "entity_type" | "created_by"> {
  statusCode: number;
  remark: object;
  entity_type: string;
}


export interface FetchFinancialYearBody {
  id?: number;
  firm_id?: number;
  branch_id?: number;
  company_id: number;
  from_date?: string | Date,
  end_date?: string | Date,
  search?: string;
  page: number;
  limit: number;
}
export interface FetchFinancialYearParams {
  offset: number;
  filters: FetchFinancialYearBody;
}
export interface FetchDbFinancialYear {
  from_date: string | Date,
  end_date: string | Date,
  entity_type: string,
  entity_id: number
  status: number;
  remarks: object | null;
}
export type FinancialYearCountResult = {
  count: string;
};



export interface EditFinancialYearBody {
  id: number
  from_date?: string | Date,
  end_date?: string | Date,
  updated_by?: string,
  entity_type: string,
  entity_id: number
  status?: string;
}

export interface EditFinancialYearParams
  extends Omit<EditFinancialYearBody, "status" | "updated_by"> {
  statusCode: number;
  remark: object
}


export interface DeleteFinancialYearBody {
  id: number;
  company_id: number;
}