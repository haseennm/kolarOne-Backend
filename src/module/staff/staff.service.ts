import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";
import { CreateStaffParams, DeleteStaffParams, EditStaffParams, FetchDbStaff, FetchStaffParams, StaffCountResult, StaffLoginBody } from "./staff.types";


export default class StaffService {

  async createStaff(data: CreateStaffParams, client: any) {

    const {
      entity_id,
      company_id,
      entity_type,
      email,
      finger_id,
      full_name,
      password_hash,
      remark,
      statusCode,
      phone_number,
      role,
      address,
      salary,
      entity_table,
      branch_id,
      designation
    } = data;

    // Check company
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

    if (entity_type === "F") {

      const branchFirm = await executeInTransaction(
        client,
        `
    SELECT id
    FROM firm
    WHERE branch_id = $1
    `,
        [branch_id]
      );

      if (branchFirm.rowCount === 0) {
        throw new AppError("No Firm found in this branch", 404);
      }

      const firmIds = branchFirm.rows.map((f: any) => f.id);
      const isFinger_exist = await executeInTransaction(
        client,
        `
    SELECT id
    FROM staff
    WHERE finger_id = $1
    AND entity_type = 'F'
    AND entity_id = ANY($2)
    `,
        [finger_id, firmIds]
      );

      if (isFinger_exist.rowCount) {
        throw new AppError("Finger print already exist in this branch", 400);
      }
    }

    // Check roles
    if (role) {
      for (const roleId of role) {
        const isRoleExist = await getRecord(roleId, "role", "id", Number(roleId), client);

        if (!isRoleExist) {
          throw new AppError("One or more roles do not exist", 404);
        }
      }
    }

    // Check entity
    const column =
      entity_type === "F"
        ? "branch_id"
        : entity_type === "C"
          ? "id"
          : "company_id";

    const value =
      entity_type === "F"
        ? branch_id
        : entity_type === "C"
          ? company_id
          : company_id;

    const isEntityExist = await getRecord(
      entity_id,
      entity_table,
      column,
      value ?? 0,
      client
    );

    if (!isEntityExist) {
      throw new AppError(`${entity_table} not found`, 404);
    }

    const queryText = `
    INSERT INTO staff (
      company_id,
      entity_type,
      entity_id,
      role,
      status,
      email,
      password_hash,
      full_name,
      phone_number,
      address,
      salary,
      finger_id,
      remarks,
      designation
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )
    RETURNING *;
  `;

    const values = [
      company_id,
      entity_type,
      entity_id,
      role, // SMALLINT[]
      statusCode,
      email,
      password_hash,
      full_name,
      phone_number,
      address,
      salary ?? 0,
      finger_id,
      JSON.stringify(remark || {}),
      designation
    ];

    const { rows } = await executeInTransaction(client, queryText, values);

    return rows[0];
  }


  async fetchStaff(data: FetchStaffParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // Exclude deleted
    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters?.entity_type) {
      values.push(filters.entity_type);
      where.push(`entity_type = $${values.length}`);
    }

    if (filters?.entity_id) {
      values.push(filters.entity_id);
      where.push(`entity_id = $${values.length}`);
    }

    if (filters?.status !== undefined) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }

    if (filters?.role && filters.role.length) {
      values.push(filters.role);
      where.push(`role && $${values.length}::smallint[]`);
    }

    // Search
    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      email ILIKE $${values.length} OR
      full_name ILIKE $${values.length} OR
      phone_number ILIKE $${values.length} OR
      address ILIKE $${values.length}
    )`);
    }

    // Company filter (mandatory)
    values.push(filters.company_id);
    where.push(`company_id = $${values.length}`);

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const staffQuery = `
 SELECT 
  s.*,
  (
    SELECT json_agg(
      json_build_object(
        'id', r.id,
        'role', r.role
      )
    )
    FROM role r
    WHERE r.id = ANY(s.role)
  ) as role_details
FROM staff s
${whereClause}
ORDER BY s.id DESC
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM staff
    ${whereClause}
  `;

    const staff = await query<FetchDbStaff>(
      staffQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<StaffCountResult>(countQuery, values);

    return {
      staff,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }

  async updateStaff(data: EditStaffParams, client: any) {

    const {
      id,
      company_id,
      role,
      full_name,
      address,
      phone_number,
      entity_type,
      entity_id,
      finger_id,
      salary,
      statusCode,
      remark,
      entity_table,
      designation
    } = data;

    const isStaffExist = await getRecord(
      id,
      "staff",
      "company_id",
      company_id,
      client
    );

    if (!isStaffExist) {
      throw new AppError("Staff not found", 404);
    }
    const isFinger_exist = await executeInTransaction(
      client,
      `
  SELECT id
  FROM staff
  WHERE finger_id = $1
  AND entity_id = $2
  AND entity_type = $3
  `,
      [finger_id, entity_id, entity_type]
    );

    if (isFinger_exist.rowCount) {
      throw new AppError("Finger print already exist", 400);
    }
    if (entity_id) {
      const isEntityExist = await getRecord(
        entity_id,
        entity_table,
        "company_id",
        company_id,
        client
      );

      if (!isEntityExist) {
        throw new AppError(`${entity_table} not found`, 404);
      }
    }
    const updateQuery = `
    UPDATE staff
    SET
      role = $1,
      full_name = $2,
      address = $3,
      phone_number = $4,
      entity_type = $5,
      entity_id = $6,
      finger_id = $7,
      salary = $8,
      status = $9,
      remarks =
        CASE
          WHEN remarks IS NULL THEN $10::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $10::jsonb
          ELSE jsonb_build_array(remarks) || $10::jsonb
        END,
        designation = $11
    WHERE id = $12
    RETURNING *;
  `;

    const status =
      statusCode === 99
        ? isStaffExist.status
        : statusCode;

    const values = [
      role ? role : isStaffExist.role,
      full_name ?? isStaffExist.full_name,
      address ?? isStaffExist.address,
      phone_number ?? isStaffExist.phone_number,
      entity_type ?? isStaffExist.entity_type,
      entity_id ?? isStaffExist.entity_id,
      finger_id ?? isStaffExist.finger_id,
      salary ?? isStaffExist.salary,
      status,
      JSON.stringify(remark),
      designation,
      id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);

    return rows[0];
  }

  async deleteStaff(data: DeleteStaffParams, client: any) {

    const { r_id, remark, company_id, entity_id } = data;


    const isStaffExist = await getRecord(
      r_id,
      "staff",
      "company_id",
      company_id,
      client
    );

    if (!isStaffExist) {
      throw new AppError("Staff not found or already deleted", 404);
    }

    if (Number(isStaffExist.entity_id) !== entity_id) {
      throw new AppError("Entity id not matching", 400);
    }

    const queryText = `
      UPDATE staff
      SET
        status = $1,
        remarks =
          CASE
            WHEN remarks IS NULL THEN $2::jsonb
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE id = $3 AND entity_id = $4
      RETURNING *;
    `;

    const values = [
      0, // deleted status
      JSON.stringify(remark),
      r_id,
      entity_id
    ];

    const row = await executeInTransaction(client, queryText, values);

    return row.rows[0];

  }

  async loginStaff(data: StaffLoginBody) {
    const { email } = data;

    const result = await transaction(async (client) => {

      const query = `
      SELECT id, password_hash, full_name , role, entity_type
      FROM staff
      WHERE email = $1 AND status != $2
    `;

      const values = [email, 0];

      const login = await executeInTransaction(client, query, values);

      if ((login.rowCount ?? 0) < 1) {
        throw new AppError("No data found with this email", 404);
      }

      return login.rows[0];
    });

    return result;
  }
}