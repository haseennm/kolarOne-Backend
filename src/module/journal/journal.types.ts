export interface JournalCreate {
  journal: string;
  entity_id: number;
  entity_type: string;
  table_row_id: string | number;
  table_name: string;
  company_id: number;
  changes:any
}
export interface JournalFetchBody {
  entity_id: number;
  entity_type: string;
  company_id: number
  page: number;
  limit: number
}
export interface FetchJournalParams {
  offset: number;
  filters: JournalFetchBody;
}
export interface FetchDbJournal extends JournalCreate {
  id: number;
  entity_name: string;
  created_at: Date
}
export type JournalCountResult = {
  count: string;
};

export interface JournalDetailed {
  company_id: number;
  table_row_id: number;
  table_name: string
}


export type ParentConfig = {
  table: string;
  idColumn?: string;
  nameColumn: string;
  businessColumn?: string;
};