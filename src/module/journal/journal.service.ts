import { PoolClient } from "pg";
import { executeInTransaction, query } from "../../config/db";
import { JournalCreate, FetchJournalParams, FetchDbJournal, JournalCountResult, JournalDetailed } from "./journal.types";
import { PARENT_NAME_MAP } from "./journal.utils";


export default class JournalService {

  async createJournal(data: JournalCreate, client: PoolClient) {

    const { entity_id, entity_type, journal, table_name, table_row_id, company_id, changes } = data;

    const journal_sql = `
      INSERT INTO journals (
      entity_id,
      entity_type,
      journal,
      table_name,
      table_row_id,
      company_id,
      changes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;

    const values = [
      entity_id, entity_type, journal, table_name, table_row_id, company_id, changes
    ];

    const { rows } = await executeInTransaction(client, journal_sql, values);
    return rows[0];
  }

  async fetchJournal(data: FetchJournalParams) {
    const { filters, offset } = data;

    const where: string[] = [];
    const values: any[] = [];

    // 1. Fixed Company ID Filter
    // Instead of strictly filtering by c.id, we look across all potential related entities
 if (filters.company_id) {
  values.push(filters.company_id);

  where.push(`
  (
      (
          j.entity_type = 'C'
          AND j.entity_id = $${values.length}
      )

      OR

      (
          j.entity_type = 'B'
          AND EXISTS (
              SELECT 1
              FROM branches br
              WHERE br.id = j.entity_id
              AND br.company_id = $${values.length}
          )
      )

      OR

      (
          j.entity_type = 'F'
          AND EXISTS (
              SELECT 1
              FROM firm ff
              JOIN branches br
                  ON br.id = ff.branch_id
              WHERE ff.id = j.entity_id
              AND br.company_id = $${values.length}
          )
      )
  )
  `);
}

    // 2. Entity Type Filters
   if (filters.entity_type === "C") {
  values.push(filters.entity_id);

  where.push(`
  (
      (
          j.entity_type = 'C'
          AND j.entity_id = $${values.length}
      )

      OR

      (
          j.entity_type = 'B'
          AND EXISTS (
              SELECT 1
              FROM branches br
              WHERE br.id = j.entity_id
              AND br.company_id = $${values.length}
          )
      )

      OR

      (
          j.entity_type = 'F'
          AND EXISTS (
              SELECT 1
              FROM firm ff
              JOIN branches br
                  ON br.id = ff.branch_id
              WHERE ff.id = j.entity_id
              AND br.company_id = $${values.length}
          )
      )
  )
  `);
}

    if (filters.entity_type === "B") {
      values.push(filters.entity_id);
      where.push(`
      (
        (j.entity_type = 'B' AND j.entity_id = $${values.length})
        OR
        (j.entity_type = 'F' AND f.branch_id = $${values.length})
      )
    `);
    }

    if (filters.entity_type === "F") {
      values.push(filters.entity_id);
      where.push(`j.entity_type = 'F' AND j.entity_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 3. Main Query (Ensuring tables are always joined correctly so b.company_id is accessible)
    const journalSql = `
SELECT
    j.*,
    CASE
        WHEN j.entity_type = 'C' THEN c.company_name
        WHEN j.entity_type = 'B' THEN b.branch_name
        WHEN j.entity_type = 'F' THEN f.firm_name
    END AS entity_name
FROM journals j

LEFT JOIN company c
    ON j.entity_type = 'C'
    AND c.id = j.entity_id

LEFT JOIN branches b
    ON j.entity_type = 'B'
    AND b.id = j.entity_id

LEFT JOIN firm f
    ON j.entity_type = 'F'
    AND f.id = j.entity_id

${whereClause}

ORDER BY j.id DESC
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
`;

    // 4. Count Query
    const countSql = `
SELECT COUNT(*)
FROM journals j

LEFT JOIN company c
    ON j.entity_type = 'C'
    AND c.id = j.entity_id

LEFT JOIN branches b
    ON j.entity_type = 'B'
    AND b.id = j.entity_id

LEFT JOIN firm f
    ON j.entity_type = 'F'
    AND f.id = j.entity_id

${whereClause}
`;

    // Execute Queries
    const journals = await query<FetchDbJournal>(
      journalSql,
      [...values, filters.limit, offset]
    );

    const total = await query<JournalCountResult>(countSql, values);

    return {
      journals,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async journalDetailed(data: JournalDetailed) {
    const { table_name, table_row_id } = data;
    const normalizedTableName = table_name?.toLowerCase();


    const sql = `
          SELECT *
          FROM ${table_name}
          WHERE id = $1
        `;

    const result = await query<any>(sql, [table_row_id]);

    if (!result.length) {
      return "No record Found";
    }

    return result[0];
  }
  async getParentName(
    columnName: string,
    id: number | string,
    businessCategory: string | null,
    businessId: number | string | null,
  ): Promise<string | null> {
    const config = PARENT_NAME_MAP[columnName];

    if (!config) {
      return null;
    }
    console.log(`${config.nameColumn} table is ${config.table}`)
    let fetchQuery = `
    SELECT ${config.nameColumn} AS name
    FROM ${config.table}
    WHERE id = $1
      AND status != 0
  `;

    const params: any[] = [id];

    if (config.businessColumn && businessId) {
      fetchQuery += ` AND ${config.businessColumn} = $2`;
      params.push(businessId);
    }

    const result = await query<{ name: string }>(fetchQuery, params);

    return result[0]?.name ?? null;
  }
}
