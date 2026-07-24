import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import {getRecord, getStatusCode } from "../../utils/extra";
import { buildAuditChanges } from "../journal/journal.utils";
import { CreateStaffParams, DeleteStaffParams, EditStaffParams, FetchDbStaff, FetchStaffParams, StaffCountResult, StaffLoginBody, StaffTransfer, StaffTransferRemover } from "./staff.types";


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
      designation, attachments,
      blood_group,
      date_of_birth,
      driving_license_no,
      expected_salary,
      father_name,
      identification_mark,
      image,
      languages_known,
      passport_no,
      previous_organization,
      qualification,
      residence_phone,
      spouse_name,
      technical_qualification,
      working_from,
      working_to,

    } = data;

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
    designation,

    image,
    languages_known,
    attachments,

    father_name,
    spouse_name,
    residence_phone,
    date_of_birth,
    driving_license_no,
    passport_no,

    qualification,
    technical_qualification,
    previous_organization,

    blood_group,
    identification_mark,

    working_from,
    working_to,
    expected_salary
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
    $15,$16,$17,
    $18,$19,$20,$21,$22,$23,
    $24,$25,$26,
    $27,$28,
    $29,$30,$31
  )
  RETURNING *;
`;
    const values = [
      company_id,
      entity_type,
      entity_id,
      role,
      statusCode,
      email,
      password_hash,
      full_name,
      phone_number,
      address,
      salary ?? 0,
      finger_id ?? null,
      JSON.stringify(remark || {}),
      designation,

      image ?? null,
      languages_known ?? null, // TEXT[]
      JSON.stringify(attachments || []), // JSONB

      father_name ?? null,
      spouse_name ?? null,
      residence_phone ?? null,
      date_of_birth ?? null,
      driving_license_no ?? null,
      passport_no ?? null,

      qualification ?? null,
      technical_qualification ?? null,
      previous_organization ?? null,

      blood_group ?? null,
      identification_mark ?? null,

      working_from ?? null,
      working_to ?? null,
      expected_salary ?? null
    ];
    const { rows } = await executeInTransaction(client, queryText, values);

    return rows[0];
  }


  async fetchStaff(data: FetchStaffParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];
    let joins: string[] = [];

    // Exclude deleted
    where.push(`s.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`s.id = $${values.length}`);
    }

    /**
     * Entity handling
     *
     * B = Branch
     * F = Firm
     * C = Company
     */
    if (filters?.entity_type === "B" && filters?.entity_id) {

      // Branch + firm staffs
      if (filters?.firm_staff) {

        joins.push(`
        LEFT JOIN firm f
          ON f.id = s.entity_id
      `);

        values.push(filters.entity_id);

        where.push(`(
        (
          s.entity_type = 'B'
          AND s.entity_id = $${values.length}
        )
        OR
        (
          s.entity_type = 'F'
          AND f.branch_id = $${values.length}
        )
      )`);

      } else {

        // Only branch staffs
        values.push(filters.entity_id);

        where.push(`s.entity_type = 'B'`);
        where.push(`s.entity_id = $${values.length}`);
      }

    } else {

      // Normal filtering for F and C
      if (filters?.entity_type) {
        values.push(filters.entity_type);
        where.push(`s.entity_type = $${values.length}`);
      }

      if (filters?.entity_id) {
        values.push(filters.entity_id);
        where.push(`s.entity_id = $${values.length}`);
      }
    }

    if (filters?.status !== undefined) {
      values.push(filters.status);
      where.push(`s.status = $${values.length}`);
    }

    if (filters?.role && filters.role.length) {
      values.push(filters.role);
      where.push(`s.role && $${values.length}::smallint[]`);
    }

    // Search
    if (filters?.search) {
      values.push(`%${filters.search}%`);

      where.push(`(
      s.email ILIKE $${values.length} OR
      s.full_name ILIKE $${values.length} OR
      s.phone_number ILIKE $${values.length} OR
      s.address ILIKE $${values.length}
    )`);
    }

    // Company filter
    values.push(filters.company_id);
    where.push(`s.company_id = $${values.length}`);

    const joinClause = joins.join(" ");

    const whereClause = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

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
    ${joinClause}
    ${whereClause}
    ORDER BY s.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM staff s
    ${joinClause}
    ${whereClause}
  `;

    const staff = await query<FetchDbStaff>(
      staffQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<StaffCountResult>(
      countQuery,
      values
    );

    return {
      staff,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(
          Number(total[0].count) / filters.limit
        ),
      },
    };
  }

  async updateStaff(data: EditStaffParams, client: any) {
    const {
      id,
      role,
      full_name,
      father_name,
      spouse_name,
      address,
      phone_number,
      residence_phone,
      finger_id,
      salary,
      expected_salary,
      statusCode,
      remark,
      designation,
      previous_organization,
      blood_group,
      identification_mark,
      date_of_birth,
      driving_license_no,
      passport_no,
      qualification,
      technical_qualification,
      working_from,
      working_to,
      languages_known,
      image,
      attachments,
      entity_id,
      entity_type
    } = data;

    const isStaffExistResult = await executeInTransaction(
      client,
      `SELECT * FROM staff WHERE entity_id =$1 AND entity_type =$2 AND status!=$3`, [entity_id, entity_type, 0]
    );
    const isStaffExist = isStaffExistResult.rows[0]
    if (!isStaffExist) {
      throw new AppError("Staff not found", 404);
    }

    if (finger_id) {
      const isFingerExist = await executeInTransaction(
        client,
        `
      SELECT id
      FROM staff
      WHERE finger_id = $1
      AND entity_id = $2
      AND entity_type = $3
      AND id != $4
      `,
        [
          finger_id,
          isStaffExist.entity_id,
          isStaffExist.entity_type,
          id,
        ]
      );

      if (isFingerExist.rowCount) {
        throw new AppError("Finger print already exist", 400);
      }
    }

    const updateQuery = `
    UPDATE staff
    SET
      role = COALESCE($1, role),
      full_name = COALESCE($2, full_name),
      father_name = COALESCE($3, father_name),
      spouse_name = COALESCE($4, spouse_name),
      address = COALESCE($5, address),
      phone_number = COALESCE($6, phone_number),
      residence_phone = COALESCE($7, residence_phone),
      finger_id = COALESCE($8, finger_id),
      salary = COALESCE($9, salary),
      expected_salary = COALESCE($10, expected_salary),
      status = COALESCE($11, status),
      designation = COALESCE($12, designation),
      previous_organization = COALESCE($13, previous_organization),
      blood_group = COALESCE($14, blood_group),
      identification_mark = COALESCE($15, identification_mark),
      date_of_birth = COALESCE($16, date_of_birth),
      driving_license_no = COALESCE($17, driving_license_no),
      passport_no = COALESCE($18, passport_no),
      qualification = COALESCE($19, qualification),
      technical_qualification = COALESCE($20, technical_qualification),
      working_from = COALESCE($21, working_from),
      working_to = COALESCE($22, working_to),
      languages_known = COALESCE($23, languages_known),
      image = COALESCE($24, image),
      attachments = COALESCE($25, attachments),
      remarks =
        CASE
          WHEN remarks IS NULL THEN $26::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $26::jsonb
          ELSE jsonb_build_array(remarks) || $26::jsonb
        END
    WHERE id = $27
    RETURNING *;
  `;

    // ✅ Values
    const values = [
      role ?? isStaffExist.role,
      full_name ?? isStaffExist.full_name,
      father_name ?? isStaffExist.father_name,
      spouse_name ?? isStaffExist.spouse_name,
      address ?? isStaffExist.address,
      phone_number ?? isStaffExist.phone_number,
      residence_phone ?? isStaffExist.residence_phone,
      finger_id ?? isStaffExist.finger_id,
      salary ?? isStaffExist.salary,
      expected_salary ?? isStaffExist.expected_salary,
      statusCode ?? isStaffExist.status,
      designation ?? isStaffExist.designation,
      previous_organization ?? isStaffExist.previous_organization,
      blood_group ?? isStaffExist.blood_group,
      identification_mark ?? isStaffExist.identification_mark,
      date_of_birth ?? isStaffExist.date_of_birth,
      driving_license_no ?? isStaffExist.driving_license_no,
      passport_no ?? isStaffExist.passport_no,
      qualification ?? isStaffExist.qualification,
      technical_qualification ?? isStaffExist.technical_qualification,
      working_from ?? isStaffExist.working_from,
      working_to ?? isStaffExist.working_to,
      languages_known ?? isStaffExist.languages_known,
      image ?? isStaffExist.image,
      attachments ? JSON.stringify(attachments) : isStaffExist.attachments,
      JSON.stringify(remark || {}),
      id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
      const changes = buildAuditChanges(isStaffExist, rows[0]);
    return {data:rows[0],changes};
  }

  async deleteStaff(data: DeleteStaffParams, client: any) {

    const { r_id, remark, company_id, entity_id, entity_type } = data;

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
    if (isStaffExist.entity_type !== entity_type) {
      throw new AppError("Entity type not matching", 400);
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
      SELECT id, password_hash, full_name , role, entity_type , entity_id, company_id
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
  async removeTempTransferStaff(data: StaffTransferRemover) {
    const { company_id, staff_id, transfer_entity_id, } = data;

    const result = await transaction(async (client) => {

      const query = `
      SELECT * 
      FROM staff
      WHERE company_id = $1 AND status != $2 AND id =$3 AND transfer_entity_id
    `;

      const fetch_value = [company_id, getStatusCode("Deleted"), staff_id, transfer_entity_id];

      const staff = await executeInTransaction(client, query, fetch_value);

      if ((staff.rowCount ?? 0) < 1) {
        throw new AppError("No data found with this transfer", 404);
      }
      const updateQuery = `
    UPDATE staff
    SET
      transfer_entity_id = COALESCE($1, transfer_entity_id),
      remarks =
        CASE
          WHEN remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $2::jsonb
          ELSE jsonb_build_array(remarks) || $2::jsonb
        END
    WHERE id = $3 AND company_id =$4 AND transfer_entity_id =$5
    RETURNING *;
  `;

      // ✅ Values
      const values = [
        null,
        JSON.stringify([
          {
            action: "Temporary Transfer Removed",
            transferred_at: new Date().toISOString()
          }
        ]),
        staff_id,
        company_id,
        transfer_entity_id
      ];

      const { rows } = await executeInTransaction(client, updateQuery, values);
      return rows;
    });

    return result;
  }
  async transferStaff(data: StaffTransfer, entity_table: string) {
    const { staff_id, branch_id, transfer_entity_type, company_id, entity_id, entity_type, transfer_entity_id, transfer_type } = data

    const result = await transaction(async (client) => {
      const staff_exist = await executeInTransaction(client,
        ` SELECT * FROM staff WHERE id = $1 AND company_id = $2 AND entity_id = $3 AND entity_type = $4 AND status !=$5 `,
        [staff_id, company_id, entity_id, entity_type, getStatusCode('Deleted')]
      )
      if (!staff_exist.rows[0]) {
        throw new AppError("Staff not Found", 404)
      }
      if (transfer_type === "temporary") {
        const updateQuery = `
    UPDATE staff
    SET
      transfer_entity_id = COALESCE($1, transfer_entity_id),
      remarks =
        CASE
          WHEN remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $2::jsonb
          ELSE jsonb_build_array(remarks) || $2::jsonb
        END
    WHERE id = $3 AND company_id =$4 AND entity_type =$5
    RETURNING *;
  `;

        // ✅ Values
        const values = [
          transfer_entity_id,
          JSON.stringify([
            {
              action: "Temporary Transfer",
              transferred_at: new Date().toISOString()
            }
          ]),
          staff_id,
          company_id,
          entity_type
        ];

        const { rows } = await executeInTransaction(client, updateQuery, values);

        return rows[0];
      }
      if (transfer_type === "permanent") {
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
          transfer_entity_id,
          transfer_entity_type ?? staff_exist.rows[0].entity_type,
          column,
          value ?? 0,
          client
        );

        if (!isEntityExist) {
          throw new AppError(`${entity_table} not found`, 404);
        }
        const updateQuery = `
    UPDATE staff
    SET
     
      entity_id = COALESCE($1, entity_id),
      remarks =
        CASE
          WHEN remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $2::jsonb
          ELSE jsonb_build_array(remarks) || $2::jsonb
        END,
      entity_type = COALESCE($3, entity_type)
    WHERE company_id =$4 AND entity_type =$5 AND id =$6 AND entity_id =$7
    RETURNING *;
  `;

        // ✅ Values
        const values = [
          transfer_entity_id,
          JSON.stringify([
            {
              action: "Permanent Transfer",
              transferred_at: new Date().toISOString()
            }
          ]),
          transfer_entity_type ?? staff_exist.rows[0].entity_type,
          company_id,
          entity_type,
          staff_id,
          entity_id
        ];

        const { rows } = await executeInTransaction(client, updateQuery, values);

        return rows[0];
      }
    });

    return result;
  }
}