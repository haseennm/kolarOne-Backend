import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";
import {
  CreateFinancialYearParams,
  DeleteFinancialYearBody,
  EditFinancialYearParams,
  FetchDbFinancialYear,
  FetchFinancialYearParams,
  FinancialYearCountResult
} from "./financialYear.types";

export default class FinancialYearService {

  async createFinancialYear(data: CreateFinancialYearParams, client: any) {

    const { from_date, entity_type, end_date, entity_id, remark, statusCode, company_id } = data;
    console.log(data)
    // 🔐 ENTITY VALIDATION
    if (entity_type === "C") {
      // Validate company
      if (Number(entity_id) !== Number(company_id)) {
        throw new AppError("Company mismatch", 400);
      }
      const query = `SELECT id FROM company WHERE id = $1 AND status !=0`;
      const { rows } = await executeInTransaction(client, query, [entity_id]);
      console.log("first", rows)
      if (rows.length === 0) {
        throw new AppError("Invalid company_id", 400);
      }

    } else if (entity_type === "B") {
      const query = `
    SELECT id FROM branches 
    WHERE id = $1 AND company_id = $2 AND status !=0
  `;
      const { rows } = await executeInTransaction(client, query, [entity_id, company_id]);

      if (rows.length === 0) {
        throw new AppError("Branch does not belong to the given company", 400);
      }

    } else if (entity_type === "F") {
      // Validate firm → branch → company
      const query = `
    SELECT f.id 
    FROM firm f
    JOIN branches b ON f.branch_id = b.id
    WHERE f.id = $1 
      AND b.company_id = $2
      AND f.status != 0
      AND b.status != 0
  `;
      const { rows } = await executeInTransaction(client, query, [entity_id, company_id]);

      if (rows.length === 0) {
        throw new AppError("Firm does not belong to the given company", 400);
      }

    } else {
      throw new AppError("Invalid entity_type. Allowed: C, B, F", 400);
    }

    // if (!isCompanyExist) {
    //   throw new AppError("Company not found", 404);
    // }
    const overlapQuery = `
    SELECT id FROM financial_year
    WHERE entity_id = $1
      AND entity_type = $2
      AND $3 <= end_date
      AND $4 >= from_date
      AND status != $5
  `;

    const overlapValues = [entity_id, entity_type, from_date, end_date, 0];

    const { rows: overlapRows } = await executeInTransaction(
      client,
      overlapQuery,
      overlapValues
    );

    if (overlapRows.length > 0) {
      throw new AppError("Financial year overlaps with an existing one", 400);
    }

    const FinancialYearQuery = `
      INSERT INTO financial_year (
       from_date,entity_type,end_date,entity_id,remark,status,company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6, $7)
      RETURNING *;
    `;

    const values = [
      from_date, entity_type, end_date, entity_id, JSON.stringify([remark]), statusCode, company_id
    ];

    const { rows } = await executeInTransaction(client, FinancialYearQuery, values);
    return rows[0];
  }

  async fetchFinancialYear(data: FetchFinancialYearParams) {

    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];
    where.push(`status != $${values.length + 1}`);
    values.push(0);
    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`id = ANY(SELECT unnest(financial_year) FROM branches WHERE id = $${values.length}) AND entity_type = "F`);
    }
    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`id = ANY(SELECT unnest(financial_year) FROM branches WHERE id = $${values.length}) AND entity_type = "B`);
    }
    values.push(filters.company_id);
    where.push(`company_id = $${values.length}`);

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const financialYearQuery = `
  SELECT *
  FROM financial_year
  ${whereClause}
  ORDER BY id DESC
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
      SELECT COUNT(*)
      FROM financial_year
      ${whereClause}
    `;

    const financialYears = await query<FetchDbFinancialYear>(
      financialYearQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<FinancialYearCountResult>(countQuery, values);

    return {
      financialYears,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }

  async updateFinancialYear(data: EditFinancialYearParams, client: any) {
    const { id, entity_id, entity_type, end_date, from_date, statusCode, remark } = data;

    const isFinancialYearExist = await getRecord(
      id,
      "financial_year",
      entity_type,
      entity_id,
      client
    );

    if (!isFinancialYearExist) {
      throw new AppError("FinancialYear not found", 404);
    }
    const overlapQuery = `
    SELECT id FROM financial_year
    WHERE entity_id = $1
      AND entity_type = $2
      AND $3 <= end_date
      AND $4 >= from_date
      AND status = $5 AND id !=$6
  `;

    const overlapValues = [entity_id, entity_type, from_date, end_date, 0, id];

    const { rows: overlapRows } = await executeInTransaction(
      client,
      overlapQuery,
      overlapValues
    );

    if (overlapRows.length > 0) {
      throw new AppError("Financial year overlaps with an existing one", 400);
    }
    const status =
      statusCode === 99
        ? isFinancialYearExist.status
        : statusCode;

    const updateQuery = `
      UPDATE financial_year
      SET
        from_date = $1,
        end_date = $2,
        status = $3
      WHERE id = $4
      RETURNING *;
    `;

    const values = [
      from_date ?? isFinancialYearExist.FinancialYear,
      end_date ?? isFinancialYearExist.FinancialYear,
      status ?? isFinancialYearExist.status,
      id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);

    return rows[0];
  }

  async deleteFinancialYear(data: DeleteFinancialYearBody) {

    const { id, company_id } = data;
    const result = transaction(async (client) => {

      const isFinancialYearExist = await getRecord(
        id,
        "financial_year",
        "company_id",
        company_id,
        client
      );

      if (!isFinancialYearExist) {
        throw new AppError("FinancialYear not found or already deleted", 404);
      }

      const deleteQuery = `
        UPDATE FinancialYear
        SET status = 0
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await executeInTransaction(
        client,
        deleteQuery,
        [id]
      );

      return rows[0];
    });

    return result;
  }
}