import { executeInTransaction, pool, query, transaction } from "../../config/db"
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";
import { BranchLoginBody, CountResult, CreateBranchParams, DeleteBranchParams, EditBranchParams, FetchBranchParams, FetchDbBranch } from "./branch.types";

export default class BranchService {

    async createBranch(data: CreateBranchParams) {
        const {
            company_id,
            branch_code,
            branch_name,
            gstin,
            pan_number,
            address,
            city,
            district,
            state,
            state_code,
            pincode,
            statusCode,
            name_of_manager,
            phone_number,
            email,
            website,
            logo,
            remark,
            username,
            hashed,
            role

        } = data;
        const result = transaction(async (client) => {

            const isCompanyExist = await getRecord(company_id, "company", "id", company_id, client);
            if (!isCompanyExist) {
                throw new AppError("Company not found", 404);
            }

            for (const roleId of role) {
                const isRoleExist = await getRecord(roleId, "role", "company_id", company_id, client);

                if (!isRoleExist) {
                    throw new AppError("One or more roles do not exist", 404);
                }
            }
            const query = `
    INSERT INTO branches (
     company_id,
            branch_code,
            branch_name,
            gstin,
            pan_number,
            address,
            city,
            district,
            state,
            state_code,
            pincode,
            status,
            name_of_manager,
            phone_number,
            email,
            website,
            logo,
            remarks,
            username,
            password,
            role
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
    )
    RETURNING *;
  `;

            const values = [
                company_id,
                branch_code,
                branch_name,
                gstin,
                pan_number,
                address,
                city,
                district,
                state,
                state_code,
                pincode,
                statusCode,
                name_of_manager,
                phone_number,
                email,
                website,
                logo,
                JSON.stringify(remark),
                username,
                hashed,
                role
            ]

            const { rows } = await executeInTransaction(client, query, values);
            return rows[0];
        })
        return result
    }

    async fetchBranch(data: FetchBranchParams) {
        const { filters = {} } = data

        const limit = filters.limit ?? 10
        const page = filters.page ?? 1
        const offset = (page - 1) * limit

        let where: string[] = []
        let values: any[] = []

        // Exclude deleted
        where.push(`status != $${values.length + 1}`)
        values.push(-1)

        if (filters?.search) {
            values.push(`%${filters.search}%`)
            const searchIndex = values.length

            where.push(`
            (
                branch_name ILIKE $${searchIndex} OR
                branch_code ILIKE $${searchIndex} OR
                name_of_manager ILIKE $${searchIndex} OR
                gstin ILIKE $${searchIndex} OR
                pan_number ILIKE $${searchIndex} OR
                address ILIKE $${searchIndex} OR
                city ILIKE $${searchIndex} OR
                district ILIKE $${searchIndex} OR
                state ILIKE $${searchIndex} OR
                state_code ILIKE $${searchIndex} OR
                phone_number ILIKE $${searchIndex} OR
                email ILIKE $${searchIndex} OR
                pincode ILIKE $${searchIndex} OR
                website ILIKE $${searchIndex}
            )
        `)
        }

        if (filters?.id) {
            values.push(filters.id)
            where.push(`id = $${values.length}`)
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

        const branchQuery = `
        SELECT * FROM branches
        ${whereClause}
        ORDER BY id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
    `

        const countQuery = `
        SELECT COUNT(*) FROM branches
        ${whereClause}
    `

        const branch = await query<FetchDbBranch>(
            branchQuery,
            [...values, limit, offset]
        )

        const total = await query<CountResult>(countQuery, values)
        const sanitizedBranch = branch.map(({ password, ...rest }) => rest)
        return {
            branch: sanitizedBranch,
            page,
            limit,
            total: Number(total[0].count)
        }
    }
    async updateBranch(data: EditBranchParams) {

        const {
            id,
            branch_code,
            branch_name,
            gstin,
            pan_number,
            address,
            city,
            district,
            state,
            state_code,
            pincode,
            statusCode,
            name_of_manager,
            phone_number,
            email,
            website,
            logo,
            remark,
            role,
            company_id
        } = data;

        const result = transaction(async (client) => {

            // ✅ Only check by id
            const is_branch_exist = await getRecord(id, "branches", "id", id, client);

            if (!is_branch_exist) {
                throw new AppError("Branch not found or deleted", 404);
            }
            if (role) {
                for (const roleId of role) {
                const isRoleExist = await getRecord(roleId, "role", "company_id", company_id, client);

                if (!isRoleExist) {
                    throw new AppError("One or more roles do not exist", 404);
                }
            }
            }
            const query = `
        UPDATE branches 
        SET
            branch_code = $1,
            branch_name = $2,
            gstin = $3,
            pan_number = $4,
            address = $5,
            city = $6,
            district = $7,
            state = $8,
            state_code = $9,
            pincode = $10,
            status = $11,
            name_of_manager = $12,
            phone_number = $13,
            email = $14,
            website = $15,
            logo = $16,
            role = $17,
            remarks =
            CASE
                WHEN jsonb_typeof(remarks) = 'array'
                THEN remarks || $18::jsonb
                ELSE jsonb_build_array(remarks) || $18::jsonb
            END
        WHERE id = $19
        RETURNING *;
        `;

            const values = [
                branch_code ?? is_branch_exist.branch_code,
                branch_name ?? is_branch_exist.branch_name,
                gstin ?? is_branch_exist.gstin,
                pan_number ?? is_branch_exist.pan_number,
                address ?? is_branch_exist.address,
                city ?? is_branch_exist.city,
                district ?? is_branch_exist.district,
                state ?? is_branch_exist.state,
                state_code ?? is_branch_exist.state_code,
                pincode ?? is_branch_exist.pincode,
                statusCode ?? is_branch_exist.status,
                name_of_manager ?? is_branch_exist.name_of_manager,
                phone_number ?? is_branch_exist.phone_number,
                email ?? is_branch_exist.email,
                website ?? is_branch_exist.website,
                logo ?? is_branch_exist.logo,
                role ?? is_branch_exist.role,
                JSON.stringify(remark),
                id
            ];

            const { rows } = await executeInTransaction(client, query, values);
            return rows[0];
        });

        return result;
    }
    async deleteBranch(data: DeleteBranchParams) {
        const { r_id, remark, company_id } = data
        const result = transaction(async (client) => {

            const isbranch_exist = await getRecord(r_id, "branches", "company_id", company_id, client);
            if (!isbranch_exist) {
                throw new AppError("Branch not found or already deleted", 404);
            }
            const dlt_query = `
        UPDATE branches 
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

            await query(dlt_query, values);
            return `${isbranch_exist.branch_name}(${isbranch_exist.branch_code}) Company Deleted Successfull`;
        })
        return result
    }
    async loginBranch(data: BranchLoginBody) {
        const { username } = data
        const query = `SELECT id,password, branch_name, company_id,role FROM branches WHERE username = $1 AND status != $2`;
        const values = [username, 0]

        const result = await pool.query(query, values);
        return result.rows[0];
    }
}