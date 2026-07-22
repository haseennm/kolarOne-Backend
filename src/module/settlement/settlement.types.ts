export interface PaymentItem {
  payment_method_id: number;
  payment_amount: number;
  transaction_reference: string | null;
}

export interface SettlementFetchBody {
  firm_id: number;
  is_purchase :boolean;
}

export interface PurchaseSettlementSyncBody {
  firm_id: number;
  company_id: number;
  purchase_id?: number;         // Optional now
  purchase_return_id?: number;  // Optional now
  payments: PaymentItem[];      // Array of multiple payments
  updated_by: number;
}
export interface SaleSettlementSyncBody {
  firm_id: number;
  company_id: number;
  sale_id?: number;         // Optional now
  sale_return_id?: number;  // Optional now
  payments: PaymentItem[];      // Array of multiple payments
  updated_by: number;
}