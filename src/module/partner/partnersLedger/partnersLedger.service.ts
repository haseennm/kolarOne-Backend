
import { query, transaction, executeInTransaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord } from "../../../utils/extra";
import { CapitalLedgerEntry, CreateCapitalLedgerParams, DeleteCapitalLedgerParams, EditCapitalLedgerBody, EditCapitalLedgerParams, FetchCapitalLedgerFilters, PaginatedCapitalLedger } from "./partnersLedger.types";

export default class CapitalLedgerService {
  async createEntry(data: CreateCapitalLedgerParams) {
    const { partner_id, amount, entity_type, description, statusCode, remark, entity_id, flow_type } = data;
    const partner_ship = await query(
      `SELECT 1 
       FROM partner_profit_shares 
       WHERE partner_id = $1 
       AND entity_id = $2 
       AND entity_type = $3 
       AND status != 0
       LIMIT 1`,
      [partner_id, entity_id, entity_type]
    );
    if (partner_ship.length === 0) {
      throw new AppError("Partnership not found for this partner", 404);
    }
    const queryText = `
      INSERT INTO partner_capital_ledger (partner_id, amount, flow_type, description, status, remarks, entity_id, entity_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [partner_id, amount, flow_type, description, statusCode, JSON.stringify([remark]), entity_id, entity_type];

    const rows = await query(queryText, values);
    return rows[0];
  }

  async fetchEntries(filters: FetchCapitalLedgerFilters): Promise<PaginatedCapitalLedger> {
    const {
      partner_id,
      flow_type,
      entity_id,
      entity_type,
      group_type,
      page = 1,
      limit = 10
    } = filters;

    const offset = (page - 1) * limit;

    const conditions: string[] = ["status != 0"];
    const values: any[] = [];

    const addCondition = (condition: string, value?: any) => {
      if (value !== undefined) {
        values.push(value);
        conditions.push(`${condition} $${values.length}`);
      }
    };

    addCondition("partner_id =", partner_id);

    if (entity_id && entity_type) {
      values.push(entity_id);
      conditions.push(`entity_id = $${values.length}`);

      values.push(entity_type);
      conditions.push(`entity_type = $${values.length}`);
    }

    if (flow_type) {
      addCondition("flow_type =", flow_type);
    } else if (group_type) {
      if (group_type === "INCOME") {
        conditions.push(`flow_type = 'C'`);
      }

      if (group_type === "EXPENSE") {
        conditions.push(`flow_type IN ('D','S')`);
      }
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const dataQuery = `
    SELECT *
    FROM partner_capital_ledger
    ${whereClause}
    ORDER BY id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const rows = await query<CapitalLedgerEntry>(
      dataQuery,
      [...values, limit, offset]
    );

    const countQuery = `
    SELECT COUNT(*)::int AS count
    FROM partner_capital_ledger
    ${whereClause}
  `;

    const countResult = await query<{ count: number }>(countQuery, values);

    return {
      rows,
      total: countResult[0].count,
      page,
      limit
    };
  }

  async updateEntry(data: EditCapitalLedgerParams) {
    const { id, amount, description, statusCode, remark, entity_id, entity_type } = data;

    return transaction(async (client) => {
      const existing = await getRecord(
        id, "partner_capital_ledger", "entity_id", entity_id, client
      )
      if (!existing) throw new AppError("Entry not found", 404);
      const queryText = `
        UPDATE partner_capital_ledger SET
          amount = $1, description = $2, status = $3,
          remarks = remarks || $4::jsonb
        WHERE id = $5 RETURNING *;
      `;
      const values = [
        amount ?? existing.amount,
        description ?? existing.description,
        statusCode ?? existing.status,
        JSON.stringify(remark),
        id
      ];
      const { rows } = await executeInTransaction(client, queryText, values);
      return rows[0];
    });
  }

  async deleteEntry(data: DeleteCapitalLedgerParams) {
    return transaction(async (client) => {

      const existing = await getRecord(
        data.id, "partner_capital_ledger", "entity_id", data.entity_id, client
      )
      if (!existing) throw new AppError("Entry not found", 404);
    const queryText = `UPDATE partner_capital_ledger SET status = 0, remarks = remarks || $1::jsonb WHERE id = $2 AND entity_id =$3`;
    await query(queryText, [JSON.stringify(data.remark), data.id, data.entity_id]);
    return existing;
    })
  }
}