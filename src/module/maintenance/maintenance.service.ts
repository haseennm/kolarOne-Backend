import { PoolClient } from 'pg'
import { transaction, executeInTransaction } from '../../config/db'

const TABLES = [
    'stock_movements',
    'sales_items',
    'sale_return_items',
    'purchase_items',
    'purchase_return_items',

    'sales',
    'sale_return',
    'purchases',
    'purchase_return',

    'payment_transactions',
    'party_balance',

    'stock',
    'ledger_transactions',
    'journals',
    'rent_bill_items','rent_bills','loss_stocks','rent_customer_ledger','rent_payments'
]

export default class MaintenanceService {
    async clearTables({ tables }: { tables?: string[] } = {}) {
        const targetTables = tables && tables.length ? tables : TABLES

        const invalidTables = targetTables.filter((name) => !TABLES.includes(name))
        if (invalidTables.length) {
            throw new Error(`Invalid tables for clear action: ${invalidTables.join(', ')}`)
        }
        const orderedTables = TABLES.filter((t) => targetTables.includes(t))

        return transaction(async (client: PoolClient) => {
            const report: Record<string, number> = {}

            for (const table of orderedTables) {
                const result = await executeInTransaction(
                    client,
                    `TRUNCATE ${targetTables.join(', ')} RESTART IDENTITY CASCADE`
                )
                report[table] = (result.rowCount || 0)
            }

            return {
                clearedTables: orderedTables,
                rowCounts: report,
            }
        })
    }
}
