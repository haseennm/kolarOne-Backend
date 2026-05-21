export type RecentActivityEntityType = "C" | "B" | "F";

export interface RecentActivityRequest {
  entity_id: number;
  entity_type: RecentActivityEntityType;
  limit?: number;
}

export interface RecentActivityItem {
  message: string;
  datetime: string;
  company_name: string | null;
  branch_name: string | null;
  firm_name: string | null;
  payment_id: number | string;
  amount?: number | null;
}
export interface ActivityRow {
  id: number;
  remarks: unknown;
  reference_number: string | null;
  company_name: string | null;
  branch_name: string | null;
  firm_name: string | null;
  amount?: number | null;
  source?: string;
}
