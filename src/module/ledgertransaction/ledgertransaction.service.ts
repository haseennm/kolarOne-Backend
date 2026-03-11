import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { cns, isExist } from "../../utils/extra";
import { CreateLedgerTransactionParams, DeleteLedgerTransactionParams, LedgerTransactionCountResult, EditLedgerTransactionParams, FetchLedgerTransactionParams, FetchDbLedgerTransaction } from "./ledgertransaction.types";
export default class LedgerTransactionService {

  async createLedgerTransaction(data: CreateLedgerTransactionParams) {

    const {
      entity_id, amount, category_id, company_id, entity_type, reference_id,
      remark, statusCode, transaction_date
    } = data;

    const result = transaction(async (client) => {

      const isCompanyExist = await isExist(
        company_id,
        "company",
        "id",
        company_id,
        client
      );

      if (!isCompanyExist) {
        throw new AppError("Company not found", 404);
      }
      const isCategory_exist = await isExist(
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

      const isEntityExist = await isExist(
        entity_id,
        entity_table,
        "company_id",
        company_id,
        client
      );

      if (!isEntityExist) {
        throw new AppError(`${entity_table} not found`, 404);
      }


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

      return `Ledger transaction created of  ${rows[0].amount}`;
    });

    return result;
  }


  async fetchLedgerTransaction(data: FetchLedgerTransactionParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // Exclude deleted
    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters?.category_id) {
      values.push(filters.category_id);
      where.push(`category_id = $${values.length}`);
    }

    if (filters?.entity_type) {
      values.push(filters.entity_type);
      where.push(`entity_type = $${values.length}`);
    }

    if (filters?.entity_id) {
      values.push(filters.entity_id);
      where.push(`entity_id = $${values.length}`);
    }

    if (filters?.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }
    if (filters?.from_date) {
      values.push(filters.from_date);
      where.push(`transaction_date >= $${values.length}`);
    }

    if (filters?.to_date) {
      values.push(filters.to_date);
      where.push(`transaction_date <= $${values.length}`);
    }

    values.push(filters.company_id);
    where.push(`company_id = $${values.length}`);

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const ledgerTransactionQuery = `
    SELECT *
    FROM ledger_transactions
    ${whereClause}
    ORDER BY id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM ledger_transactions
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


  async updateLedgerTransaction(data: EditLedgerTransactionParams) {

    const {
      id,
      company_id,
      amount,
      category_id,
      reference_id,
      transaction_date,
      statusCode,
      remark
    } = data;

    const result = transaction(async (client) => {

      const isLedgerTransactionExist = await isExist(
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
      console.log(rows)
      return `Ledger Transaction Updated`;
    });

    return result;
  }


  async deleteLedgerTransaction(data: DeleteLedgerTransactionParams) {

    const { r_id, remark, company_id, entity_id } = data;

    const result = transaction(async (client) => {

      const isLedgerTransactionExist = await isExist(
        r_id,
        "ledger_transactions",
        "company_id",
        company_id,
        client
      );

      if (!isLedgerTransactionExist) {
        throw new AppError("Ledger transaction not found or already deleted", 404);
      }
      cns("category",[isLedgerTransactionExist.entity_id,entity_id])

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

      await executeInTransaction(client, queryText, values);

      return `Ledger Transation of  ${isLedgerTransactionExist.amount} deleted successfully`;
    });

    return result;
  }

}