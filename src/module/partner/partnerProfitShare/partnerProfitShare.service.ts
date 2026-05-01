import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord } from "../../../utils/extra";
import { CreateProfitShareParams, DeletePartnerProfitParams, EditProfitShareParams, ProfitShareFilters } from "./partnerProfitShare.types";


export default class ProfitShareService {
  async createProfitShare(data: CreateProfitShareParams, client: PoolClient) {
    const { partner_id, entity_id, entity_type, profit_share, statusCode, remark } = data;
    let company_id = null
    let branch_id = null
    if (entity_type === "F") {
      const branch = await executeInTransaction(
        client,
        `SELECT branch_id FROM firm WHERE id = $1 AND status != 0`,
        [entity_id]
      );

      if (!branch.rows.length) {
        throw new AppError("Firm not found", 404);
      }

      branch_id = branch.rows[0].branch_id;

      const company = await executeInTransaction(
        client,
        `SELECT company_id FROM branches WHERE id = $1 AND status != 0`,
        [branch_id]
      );

      if (!company.rows.length) {
        throw new AppError("Branch not found", 404);
      }

      company_id = company.rows[0].company_id;
    }
    if (entity_type === "B") {

      branch_id = entity_id
      const company = await executeInTransaction(
        client,
        `SELECT company_id 
   FROM branches 
   WHERE id = $1 AND status != 0`,
        [branch_id]
      );
      if (!company.rows.length) {
        throw new AppError("Branch not found", 404);
      }
      company_id = company.rows[0].company_id
    }
    if (entity_type === "C") company_id = entity_id
    const check_partner = await getRecord(
      partner_id,
      "partners_info",
      "company_id",
      company_id,
      client
    );

    if (!check_partner) {
      throw new AppError(`Partner Not found`, 404);
    }
    type EntityType = "F" | "B" | "C";

    const TABLE_MAP: Record<EntityType, { table: string; parent: string, parent_id: number }> = {
      F: { table: "firm", parent: "branch_id", parent_id: branch_id },
      B: { table: "branches", parent: "company_id", parent_id: company_id },
      C: { table: "company", parent: "id", parent_id: company_id },
    };

    const config = TABLE_MAP[entity_type as EntityType];

    const check_exist = await getRecord(
      entity_id,
      config.table,
      config.parent,
      config.parent_id,
      client
    );

    if (!check_exist) {
      throw new AppError(`${config.table} Not found`, 404);
    }
    const existing = await executeInTransaction(
      client,
      `SELECT 1 FROM partner_profit_shares 
   WHERE partner_id = $1 AND entity_id = $2 AND entity_type = $3 AND status !=0`,
      [partner_id, entity_id, entity_type]
    );

    if (existing.rows.length) {
      throw new AppError("Profit share already exists for this entity", 409);
    }
    const queryText = `
        INSERT INTO partner_profit_shares (partner_id, entity_id, entity_type, profit_share, status, remarks)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
    const values = [partner_id, entity_id, entity_type, profit_share, statusCode, JSON.stringify([remark])];
    console.log(entity_type)
    const { rows } = await executeInTransaction(client, queryText, values);
    return rows[0];

  }
  async editProfitShare(data: EditProfitShareParams, client: PoolClient) {
    const { entity_id, entity_type, id, remark, statusCode, profit_share } = data;

    type EntityType = "F" | "B" | "C";

    const TABLE_MAP: Record<EntityType, { table: string }> = {
      F: { table: "firm" },
      B: { table: "branches" },
      C: { table: "company" },
    };

    const config = TABLE_MAP[entity_type as EntityType];

    const check_exist = await getRecord(
      id,
      "partner_profit_shares",
      "entity_id",
      entity_id,
      client
    );

    if (!check_exist) {
      throw new AppError(`${config.table} not found`, 404);
    }

    const queryText = `
    UPDATE partner_profit_shares
    SET
      profit_share = $1,
      status = $2,
      remarks =
        CASE
          WHEN remarks IS NULL THEN $3::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $3::jsonb
          ELSE jsonb_build_array(remarks) || $3::jsonb
        END
    WHERE id = $4
      AND entity_id = $5
      AND entity_type = $6
    RETURNING *
  `;

    const values = [
      profit_share ?? check_exist.profit_share,
      statusCode ?? check_exist.status,
      JSON.stringify([remark]),
      id,
      entity_id,
      entity_type
    ];

    const { rows } = await executeInTransaction(client, queryText, values);

    return rows[0];
  }

  async fetchProfitShares(data: ProfitShareFilters) {
    const {
      partner_id,
      partner_name,
      profit_share_gt,
      profit_share_lt,
      page = 1,
      limit = 10,
      entity_id,
      entity_type
    } = data;
    console.log(data)
    const offset = (page - 1) * limit;

    let conditions: string[] = ["pps.status != 0"];
    let values: any[] = [];
    let i = 1;

    if (partner_id) {
      conditions.push(`pps.partner_id = $${i++}`);
      values.push(partner_id);
    }

    if (partner_name) {
      conditions.push(`pi.name ILIKE $${i++}`);
      values.push(`%${partner_name}%`);
    }
    if (entity_id && entity_type) {
      conditions.push(
        `pps.entity_id = $${i++} AND pps.entity_type = $${i++}`
      );
      values.push(entity_id, entity_type);
    }
    if (profit_share_gt) {
      conditions.push(`pps.profit_share > $${i++}`);
      values.push(profit_share_gt);
    }

    if (profit_share_lt) {
      conditions.push(`pps.profit_share < $${i++}`);
      values.push(profit_share_lt);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const rows = await query(
      `
  SELECT 
    pps.*, 
    pi.name as partner_name,
    pi.email as partner_email,
    pi.phone_number as partner_mobile_number,
    (
      SELECT TO_CHAR(
        TO_TIMESTAMP((elem->>'created_at')::bigint / 1000),
        'YYYY-MM-DD HH24:MI:SS'
      )
      FROM jsonb_array_elements(pps.remarks) elem
      WHERE elem->>'action' = 'Created'
      LIMIT 1
    ) AS joined_at
  FROM partner_profit_shares pps
  LEFT JOIN partners_info pi ON pps.partner_id = pi.id
  ${whereClause}
  LIMIT $${i++} OFFSET $${i++}
  `,
      [...values, limit, offset]
    );
    const count = await query(
      `
    SELECT COUNT(*) 
    FROM partner_profit_shares pps
    LEFT JOIN partners_info pi ON pps.partner_id = pi.id
    ${whereClause}
    `,
      values
    );

    return {
      rows,
      total: Number(count[0].count),
      page,
      limit
    };
  }
  async deletePartnerProfit(data: DeletePartnerProfitParams) {
    return transaction(async (client) => {

      const partnership = await executeInTransaction(
        client,
        `
      SELECT pps.partner_id, pi.name AS partner_name
      FROM partner_profit_shares pps
      LEFT JOIN partners_info pi ON pps.partner_id = pi.id
      WHERE pps.id = $1
      AND pps.entity_id = $2
      AND pps.status != 0
      `,
        [data.id, data.entity_id]
      );

      if (partnership.rowCount == 0) {
        throw new AppError("Partnership not found", 404);
      }
      const partnerName = partnership.rows[0].partner_name;

      const queryText = `
      UPDATE partner_profit_shares
      SET status = 0,
          remarks = remarks || $1::jsonb
      WHERE id = $2
    `;

      await executeInTransaction(
        client,
        queryText,
        [JSON.stringify(data.remark), data.id]
      );
      return `Partnership with ${partnerName} has been deleted successfully`;
    });
  }
}