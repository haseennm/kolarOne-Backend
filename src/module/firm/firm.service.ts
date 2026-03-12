import { Result } from "pg";
import { executeInTransaction, query, transaction } from "../../config/db";
import { isExist } from "../../utils/extra";
import {
  CountResult,
  CreateFirmParams,
  DeleteFirmParams,
  EditFirmParams,
  FetchFirmParams,
  FetchDbFirm,
  FirmLoginBody,
} from "./firm.types";
import { AppError } from "../../utils/AppError";

export default class FirmService {
  async createFirm(data: CreateFirmParams) {
    const {
      company_id,
      branch_id,
      firm_name,
      firm_code,
      name_of_manager,
      phone_number,
      email,
      website,
      logo,
      statusCode,
      remark,
      gstin,
      pan_number,
      hashed,
      username,
      role
    } = data;
    const result = transaction(async (client) => {

      const isBranchExist = await isExist(branch_id, "branches", "company_id", company_id, client);
      if (!isBranchExist) {
        throw new AppError("Branch not found", 404);
      }
      for (const roleId of role) {
        const isRoleExist = await isExist(roleId, "role", "company_id", company_id, client);

        if (!isRoleExist) {
          throw new AppError("One or more roles do not exist", 404);
        }
      }
      const queryText = `
    INSERT INTO firm (
      branch_id,
      name_of_manager,
      phone_number,
      email,
      website,
      logo,
      status,
      remarks,
      gstin,
      pan_number,
      firm_name,
    firm_code,
    password,
    username,
    role
    )
     VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,
  $9,$10,$11,$12,$13,$14,$15
)
    RETURNING *;
  `;

      const values = [
        branch_id,
        name_of_manager,
        phone_number,
        email,
        website,
        logo,
        statusCode,
        JSON.stringify(remark),
        gstin || null,
        pan_number || null,
        firm_name,
        firm_code,
        hashed,
        username,
        role
      ];

      const { rows } = await executeInTransaction(client, queryText, values);
      return `${rows[0].firm_name} created`;
    })
    return result;
  }

  async fetchFirm(data: FetchFirmParams) {
    const { filters = {} } = data;

    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    let where: string[] = [];
    let values: any[] = [];

    // Exclude deleted (-1)
    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      const searchIndex = values.length;

      where.push(`
       (
  name_of_manager ILIKE $${searchIndex} OR
  firm_code ILIKE $${searchIndex} OR
  firm_name ILIKE $${searchIndex} OR
  phone_number ILIKE $${searchIndex} OR
  email ILIKE $${searchIndex} OR
  website ILIKE $${searchIndex} OR
  gstin ILIKE $${searchIndex} OR
  pan_number ILIKE $${searchIndex} 
)
      `);
    }

    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`branch_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const firmQuery = `
      SELECT * FROM firm
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM firm
      ${whereClause}
    `;

    const firm = await query<FetchDbFirm>(
      firmQuery,
      [...values, limit, offset]
    );

    const total = await query<CountResult>(countQuery, values);

    const sanitizedFirm = firm.map(({ password, ...rest }) => rest)
    return {
      firm: sanitizedFirm,
      page,
      limit,
      total: Number(total[0].count),
    };
  }

  async updateFirm(data: EditFirmParams) {
    const {
      id,
      branch_id,
      name_of_manager,
      phone_number,
      email,
      website,
      logo,
      statusCode,
      remark,
      gstin,
      pan_number,
      firm_name,
      firm_code,
      role,
      company_id
    } = data;
    const result = transaction(async (client) => {
      const isFirmExist = await isExist(id, "firm", "branch_id", branch_id, client);

      if (!isFirmExist) {
        throw new AppError("Firm not found or deleted", 404);
      }
      if (role) {
        for (const roleId of role) {
          const isRoleExist = await isExist(roleId, "role", "company_id", company_id, client);

          if (!isRoleExist) {
            throw new AppError("One or more roles do not exist", 404);
          }
        }
      }

      const queryText = `
  UPDATE firm
SET
  name_of_manager = $1,
  phone_number = $2,
  email = $3,
  website = $4,
  logo = $5,
  status = $6,
  gstin = $7,
  pan_number = $8,
  firm_name = $9,
  firm_code = $10,
  role =$11,
  remarks =
    CASE
      WHEN remarks IS NULL THEN $12::jsonb
      WHEN jsonb_typeof(remarks) = 'array'
        THEN remarks || $12::jsonb
      ELSE jsonb_build_array(remarks) || $12::jsonb
    END
WHERE id = $13
RETURNING *;
  `;

      const values = [
        name_of_manager ?? isFirmExist.name_of_manager,
        phone_number ?? isFirmExist.phone_number,
        email ?? isFirmExist.email,
        website ?? isFirmExist.website,
        logo ?? isFirmExist.logo,
        statusCode ?? isFirmExist.status,
        gstin ?? isFirmExist.gstin,
        pan_number ?? isFirmExist.pan_number,
        firm_name ?? isFirmExist.firm_name,
        firm_code ?? isFirmExist.firm_code,
        role ?? isFirmExist.role,
        JSON.stringify(remark),
        id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);
      return `Branch ${rows[0].firm_name} Updated successfully`;
    })
    return result
  }

  async deleteFirm(data: DeleteFirmParams) {
    const { r_id, remark, branch_id } = data;
    const result = transaction(async (client) => {
      const isFirmExist = await isExist(r_id, "firm", "branch_id", branch_id, client);

      if (!isFirmExist) {
        throw new AppError("Firm not found or already deleted", 404);
      }

      const queryText = `
      UPDATE firm
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
        0, // soft delete (same as your branch logic)
        JSON.stringify(remark),
        r_id,
      ];

      await executeInTransaction(client, queryText, values);

      return `Firm ${isFirmExist.firm_name} Deleted Successfully`;
    })
    return result
  }
  async loginFirm(data: FirmLoginBody) {
    const { username } = data
    const result = transaction(async (client) => {

      const query = `SELECT id,password,firm_name FROM firm WHERE username = $1 AND status != $2`;
      const values = [username, 0]


      const login = await executeInTransaction(client, query, values);
      console.log(login)
      return login.rows[0];
    })
    return result
  }
}