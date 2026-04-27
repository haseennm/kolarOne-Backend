import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";
import {
  CreateRoleParams,
  DeleteRoleBody,
  EditRoleParams,
  FetchDbRole,
  FetchRoleParams,
  RoleCountResult
} from "./role.types";

export default class RoleService {

  async createRole(data: CreateRoleParams, client: any) {

    const { role, description, company_id, statusCode } = data;

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

    const roleQuery = `
      INSERT INTO role (
        role,
        description,
        company_id,
        status
      )
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `;

    const values = [
      role,
      description ?? null,
      company_id,
      statusCode
    ];

    const { rows } = await executeInTransaction(client, roleQuery, values);
    return rows[0];
  }

  async fetchRole(data: FetchRoleParams) {

    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];
    where.push(`status != $${values.length + 1}`);
    values.push(0);
    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    // if (filters?.status) {
    //   values.push(filters.status);
    //   where.push(`status = $${values.length}`);
    // }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`role ILIKE $${values.length}`);
    }
    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`id = ANY(SELECT unnest(role) FROM branches WHERE id = $${values.length})`);
    }
   

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

   const roleQuery = `
  SELECT *
  FROM role
  ${whereClause}
  ORDER BY id DESC
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
      SELECT COUNT(*)
      FROM role
      ${whereClause}
    `;

    const roles = await query<FetchDbRole>(
      roleQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<RoleCountResult>(countQuery, values);

    return {
      roles,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }

  async updateRole(data: EditRoleParams, client: any) {

    const { id, role, description, company_id, statusCode } = data;

    const isRoleExist = await getRecord(
      id,
      "role",
      "company_id",
      company_id,
      client
    );

    if (!isRoleExist) {
      throw new AppError("Role not found", 404);
    }

    const status =
      statusCode === 99
        ? isRoleExist.status
        : statusCode;

    const updateQuery = `
      UPDATE role
      SET
        role = $1,
        description = $2,
        status = $3
      WHERE id = $4
      RETURNING *;
    `;

    const values = [
      role ?? isRoleExist.role,
      description ?? isRoleExist.description,
      status,
      id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);

    return rows[0];
  }

  async deleteRole(data: DeleteRoleBody) {

    const { id, company_id } = data;

    const result = transaction(async (client) => {

      const isRoleExist = await getRecord(
        id,
        "role",
        "company_id",
        company_id,
        client
      );

      if (!isRoleExist) {
        throw new AppError("Role not found or already deleted", 404);
      }

      const deleteQuery = `
        UPDATE role
        SET status = 0
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await executeInTransaction(
        client,
        deleteQuery,
        [id]
      );

      return rows[0];
    });

    return result;
  }
}