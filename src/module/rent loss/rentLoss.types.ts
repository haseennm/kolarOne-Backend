export const createRentLossSchema = {
  type: "object",
  required: [
    "company_id",
    "branch_id",
    "isbyCustomer",
    "rent_stock_id",
    "product_id",
    "quantity",
    "amount",
    "paid",
    "reason",
    "created_by"
  ],
  properties: {
    created_by: {
      type: ["number", "string"]
    },
    company_id: {
      type: "number"
    },

    branch_id: {
      type: "number"
    },

    customer_id: {
      type: "string"
    },

    isbyCustomer: {
      type: "boolean",
    },

    quantity: {
      type: "number"
    },
    rent_stock_id: {
      type: "number"
    },

    product_id: {
      type: "number"
    },
    amount: {
      type: "number",
      minimum: 0
    },
    paid: {
      type: "number"
    },
    payment_method_id: {
      type: ["number", "null"]
    },
    reason: {
      type: "string",
      enum: ["Damaged", "miss"]
    }
  }
};
export interface CreateRentLossBody {
  company_id: number;
  branch_id: number;
  customer_id?: string;
  isbyCustomer: boolean;
  quantity: number;
  rent_stock_id: number;
  product_id: number;
  amount: number;
  paid?: number;
  payment_method_id?: number | null;
  reason: "Damaged" | "miss";
  created_by: string | number
}

export interface CreateRentPaymentParams {
  branch_id: number;
  amount: number;
  payment_method_id: number;
  row_type: "advance" | "loss";
  row_id: number;
  cash_flow: "in" | "out";
  note?: string | null;
  remarks?: any;
  status?: number;
}
export const payLostBillSchema = {
  type: "object",
  required: ["lost_row_id", "branch_id", "company_id"],

  anyOf: [
    {
      required: ["paid", "payment_method_id"]
    },
    {
      required: ["advance_deductions"]
    }
  ],

  properties: {
    company_id: {
      type: "number"
    },
    branch_id: {
      type: "number"
    },
    lost_row_id: {
      type: "number"
    },

    paid: {
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
      minItems: 1,
      items: {
        type: "object",
        required: ["ledger_id", "amount"],
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
export interface PayLostBillBody {
  lost_row_id: number;
  company_id: number
  branch_id: number
  advance_deductions?: AdvanceDeduction[];
  paid: number;
  payment_method_id: number;
  note?: string;
}
export interface FetchLossRentParams {
  branch_id: number;

  page?: number;
  limit?: number;

  search?: string;

  product_id?: string;
  status?: string;
  customer_id?: string;
  by_branch?: boolean
}
export const fetchLossRentSchema = {
  type: "object",
  required: ["branch_id"],
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

    product_id: {
      type: "string"
    },

    status: {
      type: "string"
    },

    customer_id: {
      type: "string"
    },

    by_branch: {
      type: "boolean"
    }
  }
};
export const DeleteLossRentSchema = {
  type: "object",
  required: ["branch_id", "id", "deleted_by"],
  properties: {
    branch_id: {
      type: "number"
    },
    id: {
      type: "number"
    },
    deleted_by: {
      type: ["string", "number"]
    }
  }
};
export interface DeleteLossRentBody {
  branch_id: number;
  id: number;
  deleted_by: number
}
export interface CreateAdvanceParams {
  customer_id: string;
  company_id: number;
  branch_id: number;

  amount: number;

  payment_method_id: number;

  note?: string;
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