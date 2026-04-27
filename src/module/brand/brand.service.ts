import { executeInTransaction, query, transaction } from "../../config/db";
import { getRecord } from "../../utils/extra";
import {
  Brand,
  CountResult,
  CreateBrandParams,
  DeleteBrandBody,
  DeleteBrandParams,
  EditBrandParams,
  FetchBrandParams,
} from "./brand.types";
import { AppError } from "../../utils/AppError";
import { DeleteBranchParams } from "../branch/branch.types";

export default class BrandService {

  async createBrand(data: CreateBrandParams) {
    const { name, statusCode, remark, company_id, note } = data;
    const result = transaction(async (client) => {

      const existing = await query(
        `SELECT id FROM brand WHERE LOWER(name) = LOWER($1) AND status != 0 AND company_id =$2`,
        [name, company_id]
      );

      if (existing.length) {
        throw new AppError("Brand already exists", 400);
      }
      const existing_company = await getRecord(company_id, "company", "id", company_id, client);

      if (!existing_company) {
        throw new AppError("Company not found or deleted", 404);
      }

      const queryText = `
        INSERT INTO brand (name, status, remarks , company_id,note)
        VALUES ($1, $2, $3 , $4 ,$5)
        RETURNING *;
      `;

      const values = [
        name,
        statusCode,
        JSON.stringify(remark),
        company_id,
        note
      ];
      const { rows } = await executeInTransaction(client, queryText, values);

      return `Brand ${rows[0].name} created successfully`;
    });

    return result;
  }
  async fetchBrand(data: FetchBrandParams) {
    const { offset, filters = {} } = data;
    console.log("filters", data)
    console.log("filters.filter?.company_id", filters.company_id)
    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters.search) {
      values.push(`%${filters.search}%`);
      where.push(`name ILIKE $${values.length}`);
    }

    if (filters.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`company_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const brandQuery = `
      SELECT * FROM brand
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM brand
      ${whereClause}
    `;

    const brand = await query<Brand>(
      brandQuery,
      [...values, limit, offset]
    );

    const total = await query<CountResult>(countQuery, values);

    return {
      brand,
      page,
      limit,
      total: Number(total[0].count),
    };
  }
  async updateBrand(data: EditBrandParams) {
    const { id, name, statusCode, remark, company_id, note } = data;

    const result = transaction(async (client) => {

      const existing = await getRecord(id, "brand", "company_id", company_id, client);

      if (!existing) {
        throw new AppError("Brand not found or deleted", 404);
      }

      const queryText = `
        UPDATE brand
        SET
          name = $1,
          status = $2,
          note =$3,
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
      const status = statusCode === 99 ? existing.status : statusCode;
      const values = [
        name ?? existing.name,
        status,
        note ?? existing.note,
        JSON.stringify(remark),
        id,
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return rows[0];
    });

    return result;
  }

  async deleteBrand(data: DeleteBrandParams) {
    const { id, remark, company_id } = data;

    const result = transaction(async (client) => {

      const existing = await getRecord(id, "brand", "company_id", company_id, client);

      if (!existing) {
        throw new AppError("Brand not found or already deleted", 404);
      }

      const queryText = `
        UPDATE brand
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
        id,
      ];

      await executeInTransaction(client, queryText, values);

      return `Brand ${existing.name} deleted successfully`;
    });

    return result;
  }
}