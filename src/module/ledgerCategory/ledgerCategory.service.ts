import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";
import { CreateLedgerCategoryParams, DeleteLedgerCategoryParams, CountResult, EditLedgerCategoryParams, FetchLedgerCategoryParams, FetchDbLedgerCategory } from "./ledgerCategory.types";
export default class LedgerCategoryService {

  async createLedgerCategory(data: CreateLedgerCategoryParams) {

    const {
      category_type,
      name,
      company_id,
      statusCode,
      remark
    } = data;

    const result = transaction(async (client) => {

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

      const queryText = `
      INSERT INTO ledger_categories (
        category_type,
        name,
        company_id,
        status,
        remarks
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *;
      `;

      const values = [
        category_type,
        name,
        company_id,
        statusCode,
        JSON.stringify(remark)
      ];
      const { rows } = await executeInTransaction(client, queryText, values);

      return `Ledger Category ${rows[0].name} created`;
    });

    return result;
  }


  async fetchLedgerCategory(data: FetchLedgerCategoryParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters?.search) {

      values.push(`%${filters.search}%`);
      const index = values.length;

      where.push(`
      (
        name ILIKE $${index}
      )
      `);
    }

    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    // company_id is required
    values.push(filters.company_id);
    where.push(`company_id = $${values.length}`);

    if (filters?.category_type) {
      values.push(filters.category_type);
      where.push(`category_type = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const ledgerCategoryQuery = `
      SELECT * FROM ledger_categories
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM ledger_categories
      ${whereClause}
    `;

    const categories = await query<FetchDbLedgerCategory>(
      ledgerCategoryQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<CountResult>(countQuery, values);

    return {
      categories,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }


  async updateLedgerCategory(data: EditLedgerCategoryParams) {

    const {
      id,
      company_id,
      category_type,
      name,
      statusCode,
      remark
    } = data;

    const result = transaction(async (client) => {

      const isLedgerCategoryExist = await getRecord(
        id,
        "ledger_categories",
        "company_id",
        company_id,
        client
      );

      if (!isLedgerCategoryExist) {
        throw new AppError("Ledger category not found", 404);
      }

      const queryText = `
      UPDATE ledger_categories
      SET
        category_type = $1,
        name = $2,
        status = $3,
        remarks =
          CASE
            WHEN remarks IS NULL THEN $4::jsonb
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $4::jsonb
            ELSE jsonb_build_array(remarks) || $4::jsonb
          END
      WHERE id = $5
      RETURNING *;
      `;
      const status = statusCode === 99
        ? isLedgerCategoryExist.status
        : statusCode;
      const values = [
        category_type ?? isLedgerCategoryExist.category_type,
        name ?? isLedgerCategoryExist.name,
        status,
        JSON.stringify(remark),
        id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);
      return `Ledger category ${rows[0].name} Updated`;
    });

    return result;
  }


  async deleteLedgerCategory(data: DeleteLedgerCategoryParams) {

    const { r_id, remark, company_id } = data;

    const result = transaction(async (client) => {

      const isLedgerCategoryExist = await getRecord(
        r_id,
        "ledger_categories",
        "company_id",
        company_id,
        client
      );

      if (!isLedgerCategoryExist) {
        throw new AppError("Ledger category not found or already deleted", 404);
      }

      const queryText = `
      UPDATE ledger_categories
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE id = $3
      RETURNING *;
      `;

      const values = [
        0,
        JSON.stringify(remark),
        r_id
      ];

      await executeInTransaction(client, queryText, values);

      return `Ledger Category ${isLedgerCategoryExist.name} deleted successfully`;
    });

    return result;
  }

}