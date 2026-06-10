// rent.types.ts

export interface CreateRentParams {
  customer_id: string;
  branch_id: number;
  company_id: number;
  expected_return_date?: string | Date;
  items: CreateRentItem[];
  payment_method_id?: number;
  amount_received?: number;
  remarks?: any[];
}

export interface CreateRentItem {
  rent_stock_id: number;
  quantity_taken: number;
  rate_per_item?: number | null;
}

export interface AdvanceDeduction {
  ledger_id: number;
  amount: number;
}

export interface ReturnRentParams {
  bill_id: number;
  company_id: number;
  branch_id: number;
  items: ReturnRentItem[];

  advance_deductions?: AdvanceDeduction[];

  payment_amount?: number;
  payment_method_id?: number;

  remarks?: any[];
}

// Master Payment structure used by both rent and loss modules
export interface CreateRentPaymentParams {
  branch_id: number;
  amount: number;
  payment_method_id: number;
  row_type: "bill" | "advance" | "loss"; 
  row_id: number;
  cash_flow: "in" | "out";
  note?: string | null;
  remarks?: any[];
  status?: number;
}

export interface ReturnRentItem {
  bill_item_id: number;
  return_qty: number;
  amount: number;

}

export interface PayBillBody {
  bill_id: number;
  company_id: number;
  amount: number;
  branch_id: number;
  payment_method_id: number;
  advance_deductions?: AdvanceDeduction[];
  note?: string;
}

export interface CreateAdvanceBody {
  customer_id: string;
  company_id: number;
  branch_id: number;
  amount: number;
  payment_method_id: number;
  note?: string;
}

export interface ReturnAdvanceBody {
  customer_id: number;     // Changed from ledger_id
  company_id: number;
  branch_id: number;
  amount: number;
  payment_method_id: number;
  note?: string;
}
export interface ReturnBillAmountBody {
  bill_id: number;     // Changed from ledger_id
  company_id: number;
  branch_id: number;
  amount: number;
  payment_method_id: number;
  note?: string;
}

export const returnBillAmountSchema = {
  type: "object",
  required: ["bill_id", "company_id", "branch_id", "amount", "payment_method_id"],
  properties: {
    bill_id: { type: "string" },
    company_id: { type: "number" },
    branch_id: { type: "number" },
    amount: { type: "number" },
    payment_method_id: { type: "number" },
    note: { type: "string" }
  }
};
export const returnAdvanceSchema = {
  type: "object",
  required: ["customer_id", "company_id", "branch_id", "amount", "payment_method_id"],
  properties: {
    customer_id: { type: "string" },
    company_id: { type: "number" },
    branch_id: { type: "number" },
    amount: { type: "number" },
    payment_method_id: { type: "number" },
    note: { type: "string" }
  }
};

export interface FetchRentQuery {
  branch_id: number;
  page?: number;
  limit?: number;
  search?: string;
  status?: string | undefined;
  customer_id?: string;
  from_date?: string;
  to_date?: string;
}
export interface FetchRentParams {
  branch_id: number;

  page?: number;
  limit?: number;

  search?: string;

  status?: number | undefined;

  customer_id?: string;

  from_date?: string;
  to_date?: string;
}
export interface FetchAdvanceLedgerParams {
  branch_id: number;

  page?: number;
  limit?: number;

  customer_id?: string;

  search?: string;
}

// Add these to the bottom of your rent.types.ts file

export const createRentSchema = {
  type: "object",
  required: ["customer_id", "branch_id", "company_id", "items"],
  properties: {
    customer_id: { type: "string" },
    branch_id: { type: "number" },
    company_id: { type: "number" },
    expected_return_date: { type: "string" },
    payment_method_id: { type: "number" },
    amount_received: { type: "number" },
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["rent_stock_id", "quantity_taken"],
        properties: {
          rent_stock_id: { type: "number" },
          quantity_taken: { type: "number" },
          rate_per_item: { type: ["number", "null"] }
        }
      }
    }
  }
};

export const returnRentSchema = {
  type: "object",
  required: ["bill_id", "company_id", "branch_id", "items"],
  properties: {
    bill_id: { type: "number" },
    company_id: { type: "number" },
    branch_id: { type: "number" },
    payment_amount: { type: "number" },
    payment_method_id: { type: "number" },
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["bill_item_id", "return_qty"],
        properties: {
          bill_item_id: { type: "number" },
          return_qty: { type: "number" }
        }
      }
    },
    advance_deductions: {
      type: "array",
      items: {
        type: "object",
        required: ["ledger_id", "amount"],
        properties: {
          ledger_id: { type: "number" },
          amount: { type: "number" }
        }
      }
    }
  }
};

export const payBillSchema = {
  type: "object",
  required: ["bill_id", "company_id", "amount", "branch_id", "payment_method_id"],
  properties: {
    bill_id: { type: "number" },
    company_id: { type: "number" },
    amount: { type: "number" },
    branch_id: { type: "number" },
    payment_method_id: { type: "number" },
    note: { type: "string" },
    advance_deductions: {
      type: "array",
      items: {
        type: "object",
        required: ["ledger_id", "amount"],
        properties: {
          ledger_id: { type: "number" },
          amount: { type: "number" }
        }
      }
    }
  }
};

export const createAdvanceSchema = {
  type: "object",
  required: ["customer_id", "company_id", "branch_id", "amount", "payment_method_id"],
  properties: {
    customer_id: { type: "string" },
    company_id: { type: "number" },
    branch_id: { type: "number" },
    amount: { type: "number" },
    payment_method_id: { type: "number" },
    note: { type: "string" }
  }
};



export const fetchRentSchema = {
  type: "object",
  properties: {
    branch_id: { type: "number" },
    page: { type: "number" },
    limit: { type: "number" },
    search: { type: "string" },
    status: { type: "string" },
    customer_id: { type: "string" },
    from_date: { type: "string" },
    to_date: { type: "string" }
  }
};