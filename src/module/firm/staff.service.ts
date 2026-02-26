import { pool } from "../../config/db"
import { GetStaffParams, StaffCreate } from "./staff.types";

export default class StaffService {
    async getAllStaffs() {
        const query = 'SELECT id, name, email, created_at FROM staffs'
        const { rows } = await pool.query(query)
        return rows
    }
    async createStaff(data:StaffCreate) {
        const { email, name } = data;
        const query = `
            INSERT INTO staffs (name, email)
            VALUES ($1, $2)
            RETURNING id, name, email, created_at
            `
        const { rows } = await pool.query(query, [name, email])
        return rows[0]
    }
    async getStaffById(data:GetStaffParams) {

        const {
            limit, offset, filters
        } = data
        let where = []
        let values = []

        if (filters.email) {
            values.push(filters.email)
            where.push(`email = $${values.length}`)
        }
        if (filters.name) {
            values.push(`%${filters.name}%`)
            where.push(`name ILIKE $${values.length}`)
        }

        if (filters.id) {
            values.push(filters.id)
            where.push(`id = $${values.length}`)
        }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

        const staffsQuery = `
        SELECT * FROM staffs
        ${whereClause}
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
    `

        const countQuery = `
        SELECT COUNT(*) FROM staffs
        ${whereClause}
    `

        const staffs = await pool.query(staffsQuery, [...values, limit, offset])
        const total = await pool.query(countQuery, values)

        return {
            staffs: staffs.rows,
            total: Number(total.rows[0].count)
        }
    }
}