export interface CreatePaymentTransaction {
    ref_id: number;
    amount: number;
    ref_type:
    | "ST"  // sale_credit
    | "SL"  // sale
    | "SR"  // sale_return
    | "PT"  // purchase_credit
    | "PS"  // purchase
    | "PR"  // purchase_return
    | "BL"  // balance
    | "LN"  // loan
    | "LR"  // loanrepay
    | "SY"  // salary
    | "LT"; // ledger_transaction
    status: number;
    payment_method_id?: number | null;
    transaction_reference?: string | null;
    business_id: number;
    business_ref: string;
    company_id: number;
    payment_flow:"E"| "I";
}

export interface EditPaymentTransaction {
    ref_id?: number;
    amount?: number;
    ref_type?:
    | "ST"  // sale_credit
    | "SL"  // sale
    | "SR"  // sale_return
    | "PT"  // purchase_credit
    | "PS"  // purchase
    | "PR"  // purchase_return
    | "BL"  // balance
    | "LN"  // loan
    | "LR"  // loanrepay
    | "SY"  // salary
    | "LT"; // ledger_transaction
    status?: number;
    payment_method_id?: number | null;
    transaction_reference?: string | null;
    business_id?: number;
    business_ref?: string;
    company_id: number;
}
export interface DeletePaymentTransaction {
    company_id: number;
    ref_id: number;
    ref_type:
    | "ST"  // sale_credit
    | "SL"  // sale
    | "SR"  // sale_return
    | "PT"  // purchase_credit
    | "PS"  // purchase
    | "PR"  // purchase_return
    | "BL"  // balance
    | "LN"  // loan
    | "LR"  // loanrepay
    | "SY"  // salary
    | "LT"; // ledger_transaction
}
export enum PaymentTransactionCode {
  ST = "sale_settlement",
  SL = "sale",
  SR = "sale_return",
  PT = "purchase_settlement",
  PS = "purchase",
  PR = "purchase_return",
  BL = "balance",
  LN = "loan",
  LR = "loan_repay",
  SY = "salary",
  LT = "ledger_transaction",
}
// paymenttransaction.types.ts

export interface GetPaymentTransactionsRequest {
  firm_id: number;
  company_id?: number;
  branch_id?: number;
  ref_type: string[]; //   Changed from string to string[]
  ref_id: number;
  payment_method_id?: number;
  payment_flow?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface GetPaymentTransactions {
  offset: number;
  filters: GetPaymentTransactionsRequest;
}
// 🟢 NEW: Request body interface from the client API
export interface BulkEditPaymentItem {
  payment_id: number;
  amount?: number;
  payment_method_id?: number | null;
  transaction_reference?: string | null;
  status?: number;
}

export interface BulkEditPaymentRequest {
  company_id: number;
  firm_id:number
  payments: BulkEditPaymentItem[];
}
export interface PaymentRow {
  id: string;
  ref_id: string;
  amount: string;
  // 🟢 FIX: Changed from PaymentTransactionCode to keyof typeof PaymentTransactionCode
  ref_type: keyof typeof PaymentTransactionCode; 
  status: number;
  payment_method_id: string;
  transaction_reference: string | null;
  business_id: string;
  company_id: number;
  business_ref: string;
  created_at: string;
  updated_at: string;
  payment_flow: string;
  payment_method: string;
  branch_id: number;
}
export interface UpdatedPaymentMetadata {
  id: number;
  ref_id: number;
  ref_type: keyof typeof PaymentTransactionCode;
  payment_flow: "I" | "E";
  company_id: number;
}