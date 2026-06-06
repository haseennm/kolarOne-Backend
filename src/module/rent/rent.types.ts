// src/types/rent.types.ts

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

export interface ReturnRentItem {
  bill_item_id: number;

  return_qty: number;

  amount: number;
}

export interface AdvanceDeduction {
  ledger_id: number;

  amount: number;
}

export interface PayBillParams {
  bill_id: number;
  branch_id: number;
  company_id: number;
  advance_deductions?: AdvanceDeduction[];

  amount: number;

  payment_method_id: number;

  note?: string;
}

export interface CreateAdvanceParams {
  customer_id: string;
  company_id: number;
  branch_id: number;

  amount: number;

  payment_method_id: number;

  note?: string;
}

export interface ReturnAdvanceParams {
  ledger_id: number;
  branch_id: number;
  company_id: number;
  amount: number;

  payment_method_id: number;

  note?: string;
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

export interface DeleteRentParams {
  bill_id: number;
}

export const createRentSchema = {
  type: "object",
  required: [
    "company_id",
    "branch_id",
    "customer_id",
    "items"
  ],
  properties: {
    company_id: {
      type: "number"
    },

    branch_id: {
      type: "number"
    },

    customer_id: {
      type: "string"
    },

    expected_return_date: {
      type: ["string", "null"],
      format: "date-time"
    },

    payment_method_id: {
      type: ["number", "null"]
    },

    amount_received: {
      type: "number",
      minimum: 0
    },

    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: [
          "rent_stock_id",
          "quantity_taken"
        ],
        properties: {
          rent_stock_id: {
            type: "number"
          },

          quantity_taken: {
            type: "number",
            minimum: 1
          },

          rate_per_item: {
            type: ["number", "null"]
          }
        }
      }
    }
  }
};
export const returnRentSchema = {
  type: "object",
  required: [
    "bill_id",
    "items",
    "branch_id"
  ],
  properties: {
    bill_id: {
      type: "number"
    },
    company_id: {
      type: "number"
    },
    branch_id: {
      type: "number"
    },

    payment_amount: {
      type: "number",
      minimum: 0
    },

    payment_method_id: {
      type: ["number", "null"]
    },

    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: [
          "bill_item_id",
          "return_qty",
          "amount"
        ],
        properties: {
          bill_item_id: {
            type: "number"
          },

          return_qty: {
            type: "number",
            minimum: 1
          },

          amount: {
            type: "number",
            minimum: 0
          }
        }
      }
    },

    advance_deductions: {
      type: "array",
      items: {
        type: "object",
        required: [
          "ledger_id",
          "amount"
        ],
        properties: {
          ledger_id: {
            type: "number"
          },

          amount: {
            type: "number",
            minimum: 0
          }
        }
      }
    }
  }
};

export const payBillSchema = {
  type: "object",
  required: [
    "bill_id",
    "amount",
    "payment_method_id",
    "branch_id",
    "company_id"
  ],
  properties: {
    company_id: {
      type: "number"
    },
    branch_id: {
      type: "number"
    },
    bill_id: {
      type: "number"
    },

    amount: {
      type: "number",
      exclusiveMinimum: 0
    },

    payment_method_id: {
      type: "number"
    },

    note: {
      type: ["string", "null"]
    },
    advance_deductions: {
      type: "array",
      items: {
        type: "object",
        required: [
          "ledger_id",
          "amount"
        ],
        properties: {
          ledger_id: {
            type: "number"
          },

          amount: {
            type: "number",
            minimum: 0
          }
        }
      }
    }
  }
};

export const createAdvanceSchema = {
  type: "object",
  required: [
    "customer_id",
    "branch_id",
    "amount",
    "payment_method_id",
    "company_id"
  ],
  properties: {
    customer_id: {
      type: "string"
    },

    company_id: {
      type: "number"
    },
    branch_id: {
      type: "number"
    },

    amount: {
      type: "number",
      exclusiveMinimum: 0
    },

    payment_method_id: {
      type: "number"
    },

    note: {
      type: ["string", "null"]
    }
  }
};

export const returnAdvanceSchema = {
  type: "object",
  required: [
    "ledger_id",
    "amount",
    "payment_method_id",
    "company_id",
    "branch_id"
  ],
  properties: {
    ledger_id: {
      type: "number"
    },
    company_id: {
      type: "number"
    },
    branch_id: {
      type: "number"
    },

    amount: {
      type: "number",
      exclusiveMinimum: 0
    },

    payment_method_id: {
      type: "number"
    },

    note: {
      type: ["string", "null"]
    }
  }
};

export const fetchRentSchema = {
  type: "object",
  required: [
    "branch_id"
  ],
  properties: {
    branch_id: {
      type: "number"
    },

    page: {
      type: "number",
      minimum: 1
    },

    limit: {
      type: "number",
      minimum: 1
    },

    search: {
      type: "string"
    },

    customer_id: {
      type: "string"
    },

    status: {
      type: "string"
    },

    from_date: {
      type: "string",
      format: "date"
    },

    to_date: {
      type: "string",
      format: "date"
    }
  }
};

export const fetchAdvanceLedgerSchema = {
  type: "object",
  required: [
    "branch_id"
  ],
  properties: {
    branch_id: {
      type: "number"
    },

    page: {
      type: "number",
      minimum: 1
    },

    limit: {
      type: "number",
      minimum: 1
    },

    customer_id: {
      type: "string"
    },

    search: {
      type: "string"
    }
  }
};

export const idParamSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: {
      type: "number"
    }
  }
};

// ======================
// CREATE RENT
// ======================

export interface CreateRentItem {
  rent_stock_id: number;
  quantity_taken: number;
  rate_per_item?: number | null;
}

export interface CreateRentBody {
  company_id: number;
  branch_id: number;
  customer_id: string;

  expected_return_date?: string;

  payment_method_id?: number;
  amount_received?: number;

  items: CreateRentItem[];
}
// ======================
// RETURN RENT
// ======================

export interface ReturnRentItem {
  bill_item_id: number;
  return_qty: number;
  amount: number;
}

export interface AdvanceDeduction {
  ledger_id: number;
  amount: number;
}

export interface ReturnRentBody {
  bill_id: number;
  branch_id: number;
  company_id: number;

  items: ReturnRentItem[];

  advance_deductions?: AdvanceDeduction[];

  payment_amount?: number;
  payment_method_id?: number;
}
// ======================
// PAY BILL
// ======================

export interface PayBillBody {
  bill_id: number;
  company_id: number
  amount: number;
  branch_id: number
  payment_method_id: number;
  advance_deductions?: AdvanceDeduction[];
  note?: string;
}
// ======================
// CREATE ADVANCE
// ======================

export interface CreateAdvanceBody {
  customer_id: string;
  company_id: number
  branch_id: number;

  amount: number;

  payment_method_id: number;

  note?: string;
}
// ======================
// RETURN ADVANCE
// ======================

export interface ReturnAdvanceBody {
  ledger_id: number;
  company_id: number;
  branch_id: number;

  amount: number;

  payment_method_id: number;

  note?: string;
}
// ======================
// FETCH RENT
// ======================

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
// ======================
// FETCH ADVANCE LEDGER
// ======================

export interface FetchAdvanceLedgerQuery {
  branch_id: number;

  page?: number;
  limit?: number;

  search?: string;

  customer_id?: string;
}
// ======================
// PARAMS
// ======================

export interface IdParams {
  id: string;
}