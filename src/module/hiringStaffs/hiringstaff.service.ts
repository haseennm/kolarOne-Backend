import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord, getStatusCode } from "../../utils/extra";
import { buildAuditChanges } from "../journal/journal.utils";
import { CreateHireStaffParams, DeleteHireStaffParams, EditStatusHireStaffParams, FetchDbHireStaff, FetchHireStaffParams, HireStaffCountResult } from "./hiringstaff.types";


export default class StaffService {

  async createHireStaff(data: CreateHireStaffParams, client: any) {
    const {
      entity_id,
      company_id,
      entity_type,
      email,
      full_name,
      remark,
      phone_number,
      address,
      entity_table,
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
    // Check entity
    const column =
      entity_type === "B"
        ? "company_id" : "id"

    const isEntityExist = await getRecord(
      entity_id,
      entity_table,
      column,
      company_id,
      client
    );

    if (!isEntityExist) {
      throw new AppError(`${entity_table} not found`, 404);
    }
    const already_exist = await executeInTransaction(
      client,
      `SELECT id
   FROM hiring_staff
   WHERE entity_id = $1
     AND entity_type = $2
     AND phone_number = $3
     AND date_of_birth = $4
     AND status = $5`,
      [
        entity_id,
        entity_type,
        phone_number,
        date_of_birth,
        getStatusCode("Pending")
      ]
    );

    if ((already_exist.rowCount ?? 0) > 0) {
      throw new AppError(
        "You have a pending application already exists there",
        400
      );
    }
    const queryText = `
  INSERT INTO hiring_staff (
    company_id,
    entity_type,
    entity_id,
    status,
    email,
    full_name,
    phone_number,
    address,
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
    $27
  )
  RETURNING *;
`;
    const values = [
      company_id,
      entity_type,
      entity_id,
      getStatusCode("Pending"),
      email,
      full_name,
      phone_number,
      address,
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

  async fetchHireStaff(data: FetchHireStaffParams) {
    const { filters, offset } = data;
    let where: string[] = [];
    let values: any[] = [];
    let joins: string[] = [];

    // Exclude deleted
    where.push(`s.status != $${values.length + 1}`);
    values.push(getStatusCode("Deleted"));

    if (filters?.id) {
      values.push(filters.id);
      where.push(`s.id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);

      where.push(`s.entity_type = 'B'`);
      where.push(`s.entity_id = $${values.length}`);
    }
    if (filters?.company_id !== undefined) {
      values.push(filters.company_id);
      where.push(`s.entity_type = 'C'`);
      where.push(`s.entity_id = $${values.length}`);
    }

    if (filters?.status !== undefined) {
      values.push(getStatusCode(filters.status));
      where.push(`s.status = $${values.length}`);
    }
    if (filters?.search) {
      values.push(`%${filters.search}%`);

      where.push(`(
      s.email ILIKE $${values.length} OR
      s.full_name ILIKE $${values.length} OR
      s.phone_number ILIKE $${values.length} OR
      s.address ILIKE $${values.length}
    )`);
    }

    const joinClause = joins.join(" ");

    const whereClause = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";
    const staffQuery = `
    SELECT 
      s.*
    FROM hiring_staff s
    ${joinClause}
    ${whereClause}
    ORDER BY s.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM hiring_staff s
    ${joinClause}
    ${whereClause}
  `;

    const staff = await query<FetchDbHireStaff>(
      staffQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<HireStaffCountResult>(
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

  async updateHireStaffStatus(data: EditStatusHireStaffParams, client: any) {
    const {
      id,
      status,
      entity_id,
      entity_type,
      remark
    } = data;

    const isStaffExistResult = await getRecord(
      id,
      "hiring_staff",
      "entity_id",
      entity_id,
      client
    );
    if (!isStaffExistResult) {
      throw new AppError("Staff not found in hiring list", 404);
    }

    const updateQuery = `
  UPDATE hiring_staff
  SET
    status = $1,

    remarks = CASE
      WHEN remarks IS NULL THEN jsonb_build_array($2::jsonb)

      WHEN jsonb_typeof(remarks) = 'array'
        THEN remarks || jsonb_build_array($2::jsonb)

      ELSE jsonb_build_array(remarks) || jsonb_build_array($2::jsonb)
    END

  WHERE id = $3
  RETURNING *;
`;

    const values = [
      getStatusCode(status),
      JSON.stringify(remark || {}),
      id
    ];

    const { rows } = await executeInTransaction(
      client,
      updateQuery,
      values
    );
    const changes = buildAuditChanges(isStaffExistResult, rows[0]);

    return {data:rows[0],changes};
  }

  async deleteHireStaff(data: DeleteHireStaffParams, client: any) {

    const { r_id, remark, company_id, entity_id, entity_type } = data;

    const isStaffExist = await getRecord(
      r_id,
      "hiring_staff",
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
      UPDATE hiring_staff
      SET
        status = $1,
        remarks = CASE
      WHEN remarks IS NULL THEN $2::jsonb
      WHEN jsonb_typeof(remarks) = 'array'
        THEN remarks || $2::jsonb
      ELSE jsonb_build_array(remarks) || $2::jsonb
    END,
      WHERE id = $3 AND entity_id = $4
      RETURNING *;
    `;

    const values = [
      getStatusCode("Deleted"), // deleted status
      JSON.stringify(remark),
      r_id,
      entity_id
    ];

    const row = await executeInTransaction(client, queryText, values);

    return row.rows[0];

  }
}