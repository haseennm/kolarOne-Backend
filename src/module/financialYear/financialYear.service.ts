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

    const { from_date, end_date, remark, statusCode, company_id } = data;
   

    // if (!isCompanyExist) {
    //   throw new AppError("Company not found", 404);
    // }
    const overlapQuery = `
    SELECT id FROM financial_year
    WHERE company_id =$1
      AND $2 <= end_date
      AND $3 >= from_date
      AND status != 0
  `;

    const overlapValues = [company_id, from_date, end_date];

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
       from_date,end_date,remark,status,company_id
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *;
    `;

    const values = [
      from_date,end_date, JSON.stringify([remark]), statusCode, company_id
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
    const { id, end_date, from_date, statusCode, remark,company_id } = data;

    const isFinancialYearExist = await getRecord(
      id,
      "financial_year",
      "company_id",
      company_id,
      client
    );

    if (!isFinancialYearExist) {
      throw new AppError("FinancialYear not found", 404);
    }
    const overlapQuery = `
    SELECT id FROM financial_year
    WHERE company_id = $1
      AND $2 <= end_date
      AND $3 >= from_date
      AND status != 0 AND id !=$4
  `;

    const overlapValues = [company_id, from_date, end_date, id];

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