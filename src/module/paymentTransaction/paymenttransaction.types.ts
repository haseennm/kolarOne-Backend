export interface CreatePaymentTransaction {
    ref_id: number;
    amount: number;
    ref_type:
    | "SC"  // sale_credit
    | "SL"  // sale
    | "SR"  // sale_return
    | "PC"  // purchase_credit
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
    company_id: number
}

export interface EditPaymentTransaction {

    company_id: number;

    ref_id?: number;
    amount?: number;
    ref_type?:
    | "SC"  // sale_credit
    | "SL"  // sale
    | "SR"  // sale_return
    | "PC"  // purchase_credit
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
}
export interface DeletePaymentTransaction {
    company_id: number;
    ref_id: number;
    ref_type:
    | "SC"  // sale_credit
    | "SL"  // sale
    | "SR"  // sale_return
    | "PC"  // purchase_credit
    | "PS"  // purchase
    | "PR"  // purchase_return
    | "BL"  // balance
    | "LN"  // loan
    | "LR"  // loanrepay
    | "SY"  // salary
    | "LT"; // ledger_transaction
}
