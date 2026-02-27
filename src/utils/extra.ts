import { pool } from "../config/db"

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

export async function isExist(id:number | string, table:string,bussiness_category:string,bussiness_id:number) {
  // bussiness_category = branch or company or firm
  // bussiness_id is row id
 const allowedTables = ["company", "branch", "firm"];
if (!allowedTables.includes(table)) {
  throw new Error("Invalid table name");
}
const  isrowExist = await pool.query(
  `SELECT * FROM ${table} WHERE id = $1 AND ${bussiness_category} = $2 AND status != $3`,
  [id,bussiness_id, 0]
  )
  return isrowExist.rows[0] || null;
} 