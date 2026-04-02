import { Client } from "pg";
import { executeInTransaction, pool, query, transaction } from "../../config/db"
import { getRecord } from "../../utils/extra";
import { CompanyLoginBody, CountResult, CreateCompanyParams, DeleteCompanyParams, EditCompanyParams, GetCompanyParams, getDbCompany } from "./company.types";
import { AppError } from "../../utils/AppError";

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
            remark,
            username,
            hashed
        } = data;

        const insert_query = `
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
      logo,
      remarks,
      username,
      password
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18
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
            JSON.stringify(remark),
            username,
            hashed
        ];

        const { rows } = await pool.query(insert_query, values);
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
        const result = transaction(async (client) => {

            const companies  = await query(
                `SELECT * FROM company WHERE id = $1 AND status != $2`,
                [id, 0]
            );

            if (companies.length === 0) {
                throw new AppError("Company not found or already deleted", 404);
            }

            const existing =  companies[0];

            const update_query = `
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
                company_name ?? existing.company_name,
                bussiness_category ?? existing.bussiness_category,
                tin_number ?? existing.tin_number,
                gstin ?? existing.gstin,
                pan_number ?? existing.pan_number,
                address ?? existing.address,
                city ?? existing.city,
                district ?? existing.district,
                state ?? existing.state,
                state_code ?? existing.state_code,
                statusCode ?? existing.status,
                phone_number ?? existing.phone_number,
                email ?? existing.email,
                website ?? existing.website,
                logo ?? existing.logo,
                JSON.stringify(remark),
                id
            ];

            const { rows } = await executeInTransaction(client,update_query, values);
            return rows[0];
        })
        return result;
    }

    async getCompany(data: GetCompanyParams) {
        const { offset, filters } = data

        let where: string[] = []
        let values: any[] = []

        where.push(`status != $${values.length + 1}`)
        values.push(0) 
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
        const sanitizedCompany = company.map(({ password, ...rest }) => rest)

        return {
            company: sanitizedCompany,
            page: filters.page,
            limit: filters.limit,
            total: Number(total[0].count)
        }
    }
    async deleteCompany(data: DeleteCompanyParams) {
        const { r_id, remark } = data
        const result = transaction(async (client) => {

            const isCompanyExist = await getRecord(r_id, "company", "id", r_id, client);
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
        })
        return result;
    }

    async loginCompany(data: CompanyLoginBody) {
        const { username, } = data
        const query = `SELECT id,password,company_name FROM company WHERE username = $1 AND status != $2`;
        const values = [username, 0]


        const result = await pool.query(query, values);
        return result.rows[0];
    }

}