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

export async function getRecord(id:number | string, table:string,bussiness_category:string,bussiness_id:number,client:PoolClient) {
  // bussiness_category = branch or company or firm
  // bussiness_id is row id
//  const allowedTables = ["company", "branches", "firm","product_categories"];
// if (!allowedTables.includes(table)) {
//   throw new Error("Invalid table name to check Exist");
// }
console.log([id,table,bussiness_category,bussiness_id])
const  isrowExist = await executeInTransaction(client,
  `SELECT * FROM ${table} WHERE id = $1 AND ${bussiness_category} = $2 AND status != $3`,
  [id,bussiness_id, 0]
  )
  return isrowExist.rows[0] || null;
} 

const ENTITY_MAP = {
  Company: "C",
  Branch: "B",
  Firm: "F",
} as const;

export type EntityKey = keyof typeof ENTITY_MAP;

export function convertEntityType(entityType: EntityKey): string {
  return ENTITY_MAP[entityType];
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
  SALE_CREDIT = "SC",
  SALE = "SL",
  SALE_RETURN = "SR",
  PURCHASE_CREDIT = "PC",
  PURCHASE = "PS",
  PURCHASE_RETURN = "PR",
  BALANCE = "BL",
  LOAN = "LN",
  LOAN_REPAY = "LR",
  SALARY = "SY",
  LEDGER_TRANSACTION = "LT"
}
export const PaymentTransactionTypeCodeMap: Record<string, PaymentTransactionCode> = {
  sale_credit: PaymentTransactionCode.SALE_CREDIT,
  sale: PaymentTransactionCode.SALE,
  sale_return: PaymentTransactionCode.SALE_RETURN,
  purchase_credit: PaymentTransactionCode.PURCHASE_CREDIT,
  purchase: PaymentTransactionCode.PURCHASE,
  purchase_return: PaymentTransactionCode.PURCHASE_RETURN,
  balance: PaymentTransactionCode.BALANCE,
  loan: PaymentTransactionCode.LOAN,
  loanrepay: PaymentTransactionCode.LOAN_REPAY,
  salary: PaymentTransactionCode.SALARY,
  ledger_transaction: PaymentTransactionCode.LEDGER_TRANSACTION
};

export const PaymentTransactionCodeTypeMap: Record<PaymentTransactionCode, string> = {
  SC: "sale_credit",
  SL: "sale",
  SR: "sale_return",
  PC: "purchase_credit",
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
  purchase_delete:StockTransactionCode.PURCHASE_DELETE,
  purchase_return_delete:StockTransactionCode.PURCHASE_RETURN_DELETE,
  sale_delete:StockTransactionCode.SALE_DELETE,
  sale_return_delete:StockTransactionCode.SALE_RETURN_DELETE
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
  branch_id: number
): Promise<boolean> => {

  const result = await executeInTransaction(
    client,
    `
    SELECT 1
    FROM attendance
    WHERE branch_id = $1
      AND staff_id = 'HOLIDAY'
      AND attendance_date = $2
    LIMIT 1
    `,
    [branch_id, today]
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