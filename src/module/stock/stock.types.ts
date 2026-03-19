export interface StockCreateBody {
  firm_id: number;
  branch_id: number;
  purchase_id: number | null;
  product_id: number;
  selling_price?: number;
  available_qty: number;
  purchased_qty: number;
  status: 'Damaged' | 'Good';
  movement_type: 'I' | 'O';
  reason: string;
  company_id:number
}
export interface StockCreateParams extends Omit<StockCreateBody, "status"> {
  statusCode: number
}

export interface StockFetchBody {
  page?: number;
  limit?: number;
  sort_by?:string;
  sort_order?:string;
  
  id?: string;
  firm_id?: number;
  branch_id?: number;
  company_id: number;

  available_qty_min: number;
  available_qty_max: number;
  purchased_qty_min: number;
  purchased_qty_max: number;

  search?: string | null;
  status?: number;
}

export interface StockFetchParams {
  offset: number;
  filters: StockFetchBody;
}
export interface StockDelete{
  id:number;
  branch_id:number
}