import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { cns, getRecord } from "../../utils/extra";
import { GetReportSalePurchaseLedger } from "../sale/sale/sale.types";
import { CreateLedgerTransactionParams, DeleteLedgerTransactionParams, LedgerTransactionCountResult, EditLedgerTransactionParams, FetchLedgerTransactionParams, FetchDbLedgerTransaction } from "./ledgertransaction.types";
export default class LedgerTransactionService {

  async createLedgerTransaction(data: CreateLedgerTransactionParams, client: any) {

    const {
      entity_id, amount, category_id, company_id, entity_type, reference_id,
      remark, statusCode, transaction_date
    } = data;


    const isCompanyExist = await getRecord(
      company_id,
      "company",
      "id",
      company_id,
      client
    );

    if (!isCompanyExist) {
      throw new AppError("Company not found", 404);
    }
    const isCategory_exist = await getRecord(
      category_id,
      "ledger_categories",
      "company_id",
      company_id,
      client
    );
    if (!isCategory_exist) {
      throw new AppError("Category not found", 404);
    }
    const entityTableMap: Record<string, string> = {
      C: "company",
      B: "branches",
      F: "firm"
    };

    const entity_table = entityTableMap[entity_type];

    if (!entity_table) {
      throw new Error("Invalid entity type");
    }

    // const isEntityExist = await getRecord(
    //   entity_id,
    //   entity_table,
    //   "company_id",
    //   company_id,
    //   client
    // );

    // if (!isEntityExist) {
    //   throw new AppError(`${entity_table} not found`, 404);
    // }


    const queryText = `
  INSERT INTO ledger_transactions (
    entity_id, amount, category_id, company_id, entity_type,
    reference_id, transaction_date, status, remarks
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  RETURNING *;
`;

    const values = [
      entity_id,
      amount,
      category_id,
      company_id,
      entity_type,
      reference_id,
      transaction_date,
      statusCode,
      JSON.stringify(remark)
    ];
    const { rows } = await executeInTransaction(client, queryText, values);

    return rows[0];

  }


  async fetchLedgerTransaction(data: FetchLedgerTransactionParams) {
    const { filters, offset } = data;
    console.log(data)
    let where: string[] = [];
    let values: any[] = [];

    // Always exclude status = 0
    values.push(0);
    where.push(`lt.status != $${values.length}`);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`lt.id = $${values.length}`);
    }

    if (filters?.category_id) {
      values.push(filters.category_id);
      where.push(`lt.category_id = $${values.length}`);
    }

    // FIX: entity_type quotes + logic grouping
    if (filters?.branch_id && filters.level === "branch") {
      values.push(filters.branch_id);
      where.push(`(lt.entity_type = 'B' AND lt.entity_id = $${values.length})`);
    }

    if (filters?.firm_id && filters.level ==="firm") {
      values.push(filters.firm_id);
      where.push(`(lt.entity_type = 'F' AND lt.entity_id = $${values.length})`);
    }

    if (filters?.status !== undefined) {
      values.push(filters.status);
      where.push(`lt.status = $${values.length}`);
    }

    if (filters?.from_date) {
      values.push(filters.from_date);
      where.push(`lt.transaction_date >= $${values.length}`);
    }

    if (filters?.to_date) {
      values.push(filters.to_date);
      where.push(`lt.transaction_date <= $${values.length}`);
    }

    // FIX: ensure company_id exists
    if (filters?.company_id && filters.level ==="company") {
      values.push(filters.company_id);
      where.push(`(lt.entity_type = 'C' AND lt.entity_id = $${values.length})`);
      
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const ledgerTransactionQuery = `
    SELECT 
      lt.*,
      lc.name AS category_name,
      lc.category_type AS flow,

      CASE 
        WHEN lt.entity_type = 'C' THEN c.company_name
        WHEN lt.entity_type = 'B' THEN b.branch_name
        WHEN lt.entity_type = 'F' THEN f.firm_name
        ELSE NULL
      END AS entity_name

    FROM ledger_transactions lt

    LEFT JOIN ledger_categories lc 
      ON lt.category_id = lc.id

    LEFT JOIN company c 
      ON lt.entity_type = 'C' AND lt.entity_id = c.id

    LEFT JOIN branches b 
      ON lt.entity_type = 'B' AND lt.entity_id = b.id

    LEFT JOIN firm f 
      ON lt.entity_type = 'F' AND lt.entity_id = f.id

    ${whereClause}

    ORDER BY lt.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;
  
    const countQuery = `
    SELECT COUNT(*) AS count
    FROM ledger_transactions lt
    ${whereClause}
  `;

    const transactions = await query<FetchDbLedgerTransaction>(
      ledgerTransactionQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<LedgerTransactionCountResult>(countQuery, values);

    return {
      transactions,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }


  async updateLedgerTransaction(data: EditLedgerTransactionParams, client: any) {

    const {
      id,
      company_id,
      amount,
      category_id,
      reference_id,
      transaction_date,
      statusCode,
      remark,
    } = data;


    const isLedgerTransactionExist = await getRecord(
      id,
      "ledger_transactions",
      "company_id",
      company_id,
      client
    );

    if (!isLedgerTransactionExist) {
      throw new AppError("Ledger transaction not found", 404);
    }

    const updateQuery = `
  UPDATE ledger_transactions
  SET
    company_id = $1,
    amount = $2,
    category_id = $3,
    reference_id = $4,
    transaction_date = $5,
    status = $6,
    remarks =
      CASE
        WHEN remarks IS NULL THEN $7::jsonb
        WHEN jsonb_typeof(remarks) = 'array'
          THEN remarks || $7::jsonb
        ELSE jsonb_build_array(remarks) || $7::jsonb
      END
  WHERE id = $8
  RETURNING *;
`;
    const status = statusCode === 99
      ? isLedgerTransactionExist.status
      : statusCode;

    const values = [
      isLedgerTransactionExist.company_id,
      amount ?? isLedgerTransactionExist.amount,
      category_id ?? isLedgerTransactionExist.category_id,
      reference_id ?? isLedgerTransactionExist.reference_id,
      transaction_date ?? isLedgerTransactionExist.transaction_date,
      status,
      JSON.stringify(remark),
      id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return rows;


  }


  async deleteLedgerTransaction(data: DeleteLedgerTransactionParams) {

    const { r_id, remark, company_id, entity_id } = data;

    const result = transaction(async (client) => {

      const isLedgerTransactionExist = await getRecord(
        r_id,
        "ledger_transactions",
        "company_id",
        company_id,
        client
      );

      if (!isLedgerTransactionExist) {
        throw new AppError("Ledger transaction not found or already deleted", 404);
      }
      cns("category", [isLedgerTransactionExist.entity_id, entity_id])

      if (isLedgerTransactionExist.entity_id != entity_id) {
        throw new AppError("Entity id not matching", 400);
      }

      const queryText = `
      UPDATE ledger_transactions
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE id = $3 AND entity_id =$4
      RETURNING *;
      `;

      const values = [
        0,
        JSON.stringify(remark),
        r_id, entity_id
      ];

      const row = await executeInTransaction(client, queryText, values);

      return row.rows[0];
    });

    return result;
  }
  async getLedgerReport(
    client: PoolClient,
    {
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date
    }: GetReportSalePurchaseLedger
  ) {

    let condition = "";
    let params: any[] = [];
    let idx = 1;

    /* ========= LEVEL FILTER ========= */

    if (level === "company") {
      condition += ` AND entity_type = 'C' AND entity_id = $${idx++}`;
      params.push(company_id);
    }

    if (level === "branch") {
      condition += ` AND entity_type = 'B' AND entity_id = $${idx++}`;
      params.push(branch_id);
    }

    if (level === "firm") {
      condition += ` AND entity_type = 'F' AND entity_id = $${idx++}`;
      params.push(firm_id);
    }

    /* ========= DATE FILTER ========= */

    if (start_date) {
      condition += ` AND transaction_date >= $${idx++}`;
      params.push(start_date);
    }

    if (end_date) {
      condition += ` AND transaction_date <= $${idx++}`;
      params.push(end_date);
    }

    const query = `
    SELECT
      CASE WHEN amount > 0 THEN 'income' ELSE 'expense' END AS type,
      id,
      transaction_date AS date,
      amount,
      reference_id AS invoice
    FROM ledger_transactions
    WHERE status != 0
    ${condition}
    ORDER BY transaction_date DESC
  `;

    const { rows } = await client.query(query, params);

    return rows;
  }
}