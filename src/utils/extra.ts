import { PoolClient } from "pg"
import { executeInTransaction, pool, query } from "../config/db"

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
  11: 'Partial'
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

export async function isExist(id:number | string, table:string,bussiness_category:string,bussiness_id:number,client:PoolClient) {
  // bussiness_category = branch or company or firm
  // bussiness_id is row id
//  const allowedTables = ["company", "branches", "firm","product_categories"];
// if (!allowedTables.includes(table)) {
//   throw new Error("Invalid table name to check Exist");
// }
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