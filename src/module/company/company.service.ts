import { pool, query } from "../../config/db"
import { AppError } from "../../middleware/errorMiddlware";
import { isExist } from "../../utils/extra";
import { CountResult, CreateCompanyParams, DeleteCompanyParams, EditCompanyParams, GetCompanyParams, getDbCompany } from "./company.types";

export default class CompanyService {

    async createCompany(data: CreateCompanyParams) {
        const {
            company_name,
            bussiness_category,
            tin_number,
            gstin,
            pan_number,
            address,
            city,
            district,
            state,
            state_code,
            statusCode,
            phone_number,
            email,
            website,
            logo,
            remark
        } = data;

        const query = `
    INSERT INTO company (
      company_name,
      bussiness_category,
      tin_number,
      gstin,
      pan_number,
      address,
      city,
      district,
      state,
      state_code,
      status,
      phone_number,
      email,
      website,
      logo,remarks
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16
    )
    RETURNING *;
  `;

        const values = [
            company_name,
            bussiness_category,
            tin_number,
            gstin,
            pan_number,
            address,
            city,
            district,
            state,
            state_code,
            statusCode,
            phone_number,
            email,
            website,
            logo,
            JSON.stringify(remark)
        ];

        const { rows } = await pool.query(query, values);
        return rows[0];
    }
    async updateCompany(data: EditCompanyParams) {
        const {
            id,
            company_name,
            bussiness_category,
            tin_number,
            gstin,
            pan_number,
            address,
            city,
            district,
            state,
            state_code,
            statusCode,
            phone_number,
            email,
            website,
            logo,
            remark
        } = data;
        // check is company exist and it is status is not Deleted
        const isCompanyExist = await pool.query(
            `SELECT * FROM company WHERE id = $1 AND status != $2`,
            [id, 0]
        );

        if (!isCompanyExist) {
            throw new AppError("Company not found or already deleted", 404);
        }
        // remark want  append previous remarks not replace
        const query = `
    UPDATE company 
     SET
      company_name = $1,
      bussiness_category = $2,
      tin_number = $3,
      gstin = $4,
      pan_number = $5,
      address = $6,
      city = $7,
      district = $8,
      state = $9,
      state_code = $10,
      status = $11,
      phone_number = $12,
      email = $13,
      website = $14,
      logo = $15,
      remarks =
  CASE
    WHEN jsonb_typeof(remarks) = 'array'
      THEN remarks || $16::jsonb
    ELSE jsonb_build_array(remarks) || $16::jsonb
  END
    WHERE id = $17
    RETURNING *;
  `;

        const values = [
            company_name,
            bussiness_category,
            tin_number,
            gstin,
            pan_number,
            address,
            city,
            district,
            state,
            state_code,
            statusCode,
            phone_number,
            email,
            website,
            logo,
            JSON.stringify(remark),
            id
        ];

        const { rows } = await pool.query(query, values);
        return rows[0];
    }

    async getCompany(data: GetCompanyParams) {
        const { offset, filters } = data

        let where: string[] = []
        let values: any[] = []

        // Always exclude deleted
        where.push(`status != $${values.length + 1}`)
        values.push(0) // 0 = Deleted

        // Search across multiple columns
        if (filters.search) {
            values.push(`%${filters.search}%`)
            const searchIndex = values.length

            where.push(`
            (
                company_name ILIKE $${searchIndex} OR
                bussiness_category ILIKE $${searchIndex} OR
                tin_number ILIKE $${searchIndex} OR
                gstin ILIKE $${searchIndex} OR
                pan_number ILIKE $${searchIndex} OR
                address ILIKE $${searchIndex} OR
                city ILIKE $${searchIndex} OR
                district ILIKE $${searchIndex} OR
                state ILIKE $${searchIndex} OR
                state_code ILIKE $${searchIndex} OR
                phone_number ILIKE $${searchIndex} OR
                email ILIKE $${searchIndex}
            )
        `)
        }

        // Optional filter by id
        if (filters.id) {
            values.push(filters.id)
            where.push(`id = $${values.length}`)
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

        const companyQuery = `
        SELECT * FROM company
        ${whereClause}
        ORDER BY id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
    `

        const countQuery = `
        SELECT COUNT(*) FROM company
        ${whereClause}
    `

        const company = await query<getDbCompany>(companyQuery, [...values, filters.limit, offset])
        const total = await query<CountResult>(countQuery, values)

        return {
            company: company,
            page: filters.page,
            limit: filters.limit,
            total: Number(total[0].count)
        }
    }
    async deleteCompany(data: DeleteCompanyParams) {
        const { r_id, remark } = data
        const isCompanyExist = await isExist(r_id, "company", "id", r_id);
        if (!isCompanyExist) {
            throw new AppError("Company not found or already deleted", 404);
        }
        const query = `
         UPDATE company 
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

        await pool.query(query, values);
        return `${isCompanyExist.company_name} Company Deleted Successfull`;
    }
}