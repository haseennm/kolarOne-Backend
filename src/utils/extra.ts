import { PoolClient } from "pg"
import { executeInTransaction, pool, query } from "../config/db"
import { AppError } from "./AppError"

export const cns = (url: string, values: string | object) => {
  console.log(
    `\x1b[43m\x1b[30m ${url} \x1b[0m`,
    `\x1b[32m${JSON.stringify(values)}\x1b[0m`
  )
}
export const el = (errr: any) => {
  console.log(`\x1b[41m${errr}\x1b[0m`
  )
}

export const STATUS_MAP = {
  0: 'Deleted',
  1: 'Active',
  2: 'Inactive',
  3: 'Pending',
  4: 'Completed',
  5: 'Paid',
  6: 'Generated',
  7: 'Confirm',
  8: 'Closed',
  9: 'Cancelled',
  10: 'Unpaid',
  11: 'Partial',
  12: 'Good',
  13: 'Damaged',
  14: 'Advance',
  15: 'Miss',
  16: 'Overdue',
  17: 'Blacklist',
  18: 'Returned',
  19: 'Hold',
  20: 'Denied',
  21: 'Accepted',
  22: "Over Pay"
} as const
export const STATUS_REVERSE_MAP = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([key, value]) => [
    value.toLowerCase(),
    Number(key)
  ])
)
export function getStatusCode(status: string): number {
  const code = STATUS_REVERSE_MAP[status.toLowerCase()]
  if (code === undefined) {
    throw new Error(`Invalid status: ${status}`)
  }
  return code
}

export function getStatusText(code: number): string {
  return STATUS_MAP[code as keyof typeof STATUS_MAP] ?? 'Unknown'
}

export async function getRecord(id: number | string, table: string, bussiness_category: string, bussiness_id: number | string, client: PoolClient) {
  // bussiness_category = branch or company or firm
  // bussiness_id is row id
  //  const allowedTables = ["company", "branches", "firm","product_categories"];
  // if (!allowedTables.includes(table)) {
  //   throw new Error("Invalid table name to check Exist");
  // }
  console.log([id, table, bussiness_category, bussiness_id])
  const isrowExist = await executeInTransaction(client,
    `SELECT * FROM ${table} WHERE id = $1 AND ${bussiness_category} = $2 AND status != $3`,
    [id, bussiness_id, 0]
  )
  return isrowExist.rows[0] || null;
}
export async function getCompanyId(
  client: PoolClient,
  branch_id?: number,
  firm_id?: number
): Promise<number | null> {
  let companyId: number | null = null;
  if (branch_id) {
    const branchResult = await executeInTransaction(
      client,
      `SELECT company_id FROM branches WHERE id = $1 AND status != $2`,
      [branch_id, 0]
    );

    companyId = branchResult.rows[0]?.company_id || null;
  } else if (firm_id) {
    const firmResult = await executeInTransaction(
      client,
      `
      SELECT b.company_id
      FROM firm f
      INNER JOIN branches b ON b.id = f.branch_id
      WHERE f.id = $1
        AND f.status != $2
        AND b.status != $2
      `,
      [firm_id, 0]
    );

    companyId = firmResult.rows[0]?.company_id || null;
  }

  return companyId;
}
// const ENTITY_MAP = {
//   Company: "C",
//   Branch: "B",
//   Firm: "F",
// } as const;

// export type EntityKey = keyof typeof ENTITY_MAP;

// export function convertEntityType(entityType: EntityKey): string {
//    return ENTITY_MAP[entityType.toLowerCase() as EntityKey];
// }
const ENTITY_MAP = {
  Company: "C",
  Branch: "B",
  Firm: "F",
} as const;

export type EntityKey = keyof typeof ENTITY_MAP;

export function convertEntityType(entityType: string): string {
  const formatted =
    entityType.charAt(0).toUpperCase() +
    entityType.slice(1).toLowerCase();

  const converted = ENTITY_MAP[formatted as EntityKey];

  if (!converted) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }

  return converted;
}

export function convertEntityCode(code: string): EntityKey | undefined {
  return (Object.keys(ENTITY_MAP) as EntityKey[]).find(
    key => ENTITY_MAP[key] === code
  );
}

// 
// PAYMENT TRANSACTION
// 
export enum PaymentTransactionCode {
  SALE_SETTLEMENT = "ST",
  SALE = "SL",
  SALE_RETURN = "SR",
  PURCHASE_SETTLEMENT = "PT",
  PURCHASE = "PS",
  PURCHASE_RETURN = "PR",
  BALANCE = "BL",
  LOAN = "LN",
  LOAN_REPAY = "LR",
  SALARY = "SY",
  LEDGER_TRANSACTION = "LT"
}
export const PaymentTransactionTypeCodeMap: Record<string, PaymentTransactionCode> = {
  sale_settlement: PaymentTransactionCode.SALE_SETTLEMENT,
  sale: PaymentTransactionCode.SALE,
  sale_return: PaymentTransactionCode.SALE_RETURN,
  purchase_settlement: PaymentTransactionCode.PURCHASE_SETTLEMENT,
  purchase: PaymentTransactionCode.PURCHASE,
  purchase_return: PaymentTransactionCode.PURCHASE_RETURN,
  balance: PaymentTransactionCode.BALANCE,
  loan: PaymentTransactionCode.LOAN,
  loanrepay: PaymentTransactionCode.LOAN_REPAY,
  salary: PaymentTransactionCode.SALARY,
  ledger_transaction: PaymentTransactionCode.LEDGER_TRANSACTION
};

export const PaymentTransactionCodeTypeMap: Record<PaymentTransactionCode, string> = {
  ST: "sale_settlement",
  SL: "sale",
  SR: "sale_return",
  PT: "purchase_settlement",
  PS: "purchase",
  PR: "purchase_return",
  BL: "balance",
  LN: "loan",
  LR: "loanrepay",
  SY: "salary",
  LT: "ledger_transaction"
};


// 
// STOCK
// 
// 🔹 Transaction Codes (DB)
export enum StockTransactionCode {
  SALE = "SL",
  PURCHASE = "PS",
  SALE_RETURN = "SR",
  PURCHASE_RETURN = "PR",
  SALE_RETURN_DELETE = "SRD",
  PURCHASE_RETURN_DELETE = "PRD",
  ADDITION = "AT",
  SALE_DELETE = "SD",
  PURCHASE_DELETE = "PD",
}

// 🔹 Transaction Types (App/API)
export type StockTransactionType =
  | "sale"
  | "purchase"
  | "sale_return"
  | "purchase_return"
  | "sale_delete"
  | "purchase_delete"
  | "sale_return_delete"
  | "purchase_return_delete"
  | "addition";

// 🔹 Type → Code (Single Source of Truth)
export const StockTransactionTypeCodeMap: Record<
  StockTransactionType,
  StockTransactionCode
> = {
  sale: StockTransactionCode.SALE,
  sale_return: StockTransactionCode.SALE_RETURN,
  purchase: StockTransactionCode.PURCHASE,
  purchase_return: StockTransactionCode.PURCHASE_RETURN,
  addition: StockTransactionCode.ADDITION,
  purchase_delete: StockTransactionCode.PURCHASE_DELETE,
  purchase_return_delete: StockTransactionCode.PURCHASE_RETURN_DELETE,
  sale_delete: StockTransactionCode.SALE_DELETE,
  sale_return_delete: StockTransactionCode.SALE_RETURN_DELETE
};

// 🔹 Code → Type (Auto Generated)
export const StockTransactionCodeTypeMap: Record<
  StockTransactionCode,
  StockTransactionType
> = Object.fromEntries(
  Object.entries(StockTransactionTypeCodeMap).map(([type, code]) => [
    code,
    type
  ])
) as Record<StockTransactionCode, StockTransactionType>;
// ✅ Convert type → code
export const getTransactionCode = (
  type: StockTransactionType
): StockTransactionCode => {
  return StockTransactionTypeCodeMap[type];
};

// ✅ Convert code → type
export const getTransactionType = (
  code: StockTransactionCode
): StockTransactionType => {
  return StockTransactionCodeTypeMap[code];
};

// ✅ Safe parser (for API input)
export const isValidTransactionType = (
  value: string
): value is StockTransactionType => {
  return value in StockTransactionTypeCodeMap;
};

// 
// ATTENDANCE
// 

export const isValidDay = async (
  client: PoolClient,
  today: string,
  entity_id: number,
  entity_type: string
): Promise<boolean> => {

  const result = await executeInTransaction(
    client,
    `
    SELECT 1
    FROM attendance
    WHERE entity_id = $1
      AND staff_id = 'HOLIDAY'
      AND attendance_date = $2
      AND entity_type = $3
    LIMIT 1
    `,
    [entity_id, today, entity_type]
  );

  if (result.rows.length > 0) {
    throw new AppError(
      `Attendance cannot be marked on ${today} (Holiday)`,
      400
    );
  }

  return true;
};
export function isFutureDay(date: string | Date): boolean {
  if (!date) return false;

  const target = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(target.getTime())) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return targetDay > today;
}
export const getFirstDayOfCurrentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const getLastDayOfCurrentMonth = (): string => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export const getFirstDayOfCurrentYear = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
};

export const getLastDayOfCurrentYear = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-12-31`;
};
export function isValidDateFormat(date: string): boolean {
  if (!date) return false;

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;

  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day);

  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}


// 
// TABLE
// 
const TABLE_MAP: Record<string, string> = {
  attendance: "ATTN",
  branches: "BRCH",
  brand: "BRND",
  company: "COMP",
  company_branding: "CBRN",
  customers: "CUST",
  financial_year: "FYER",
  firm: "FIRM",
  hiring_staff: "HSTF",
  journals: "JRNL",
  ledger_categories: "LCAT",
  ledger_transactions: "LTRN",
  loss_stocks: "LSTK",
  partner_capital_ledger: "PCLG",
  partner_profit_shares: "PPFS",
  partners_info: "PINF",
  party_balance: "PTBL",
  payment_methods: "PMTH",
  payment_transactions: "PTRN",
  product_categories: "PCAT",
  products: "PROD",
  purchases: "PURC",
  purchase_items: "PUIT",
  purchase_return: "PRTN",
  purchase_return_items: "PRIT",
  quotations: "QUOT",
  quotation_items: "QITM",
  rent_bill_items: "RBIT",
  rent_bills: "RBIL",
  rent_customer_ledger: "RCLG",
  rent_payments: "RPAY",
  rental_stocks: "RSTK",
  role: "ROLE",
  salary_generations: "SALG",
  sales: "SALE",
  sales_items: "SLIT",
  sale_return: "SRTN",
  sale_return_items: "SRIT",
  sale_returns: "SRET",
  staff: "STAF",
  staff_loans: "STLN",
  stock: "STCK",
  stock_adjustments: "SADJ",
  stock_movements: "SMOV",
  vendors: "VEND",
};

const SHORT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([full, short]) => [short, full])
);

export function toShortTableName(tableName: string): string {
  const shortName = TABLE_MAP[tableName];

  if (!shortName) {
    throw new AppError(`Invalid table name: ${tableName}`, 400);
  }

  return shortName;
}

export function toFullTableName(shortName: string): string {
  const fullName = SHORT_MAP[shortName.toUpperCase()];

  if (!fullName) {
    throw new AppError(`Invalid table code: ${shortName}`, 400);
  }

  return fullName;
}

export const billStatus = (
  final_amount: number,
  paid_amount: number
): number => {
  if (paid_amount <= 0) {
    console.log("UNPAID")
    return getStatusCode("Unpaid");
  }
  if (paid_amount == final_amount) {
    console.log("PAID")
    return getStatusCode("Paid");
  }
  if (paid_amount > final_amount) {
    console.log("OVER PAY")
    return getStatusCode("Over Pay");
  }
  console.log("PARTIAL")
  return getStatusCode("Partial");
}