import { pool, query } from "../../config/db"
import { CountResult, CreateCompanyParams, GetCompanyParams, getDbCompany } from "./company.types";

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
            remark
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
        page:filters.page,
        limit:filters.limit,
        total: Number(total[0].count)
    }
}

}