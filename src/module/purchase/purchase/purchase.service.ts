import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { isExist } from "../../../utils/extra";
import { PurchaseCreateParams } from "./purchase.types";

export default class PurchaseService {

  async createPurchase(data: PurchaseCreateParams, client: PoolClient) {
    const {
      bill_date,
      bill_number,
      discount,
      final_amount,
      firm_id,
      net_amount,
      payment_amount,
      payment_method_id,
      remark,
      statusCode,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      vendor_id,
      notes,
      transaction_reference,
      branch_id,
      company_id
    } = data;

    // Check firm existence
    const isCompanyExist = await isExist(
      firm_id,
      "firm",
      "branch_id",
      branch_id,
      client
    );

    if (!isCompanyExist) {
      throw new AppError("Firm not found", 404);
    }
    const is_payment_method_exist = await isExist(
      payment_method_id,
      "payment_methods",
      "company_id",
      company_id,
      client
    );

    if (!is_payment_method_exist) {
      throw new AppError("payment method not found", 404);
    }
    const is_vendor_exist = await isExist(
      vendor_id,
      "vendors",
      "company_id",
      company_id,
      client
    );

    if (!is_vendor_exist) {
      throw new AppError("Vendor not found", 404);
    }
    const is_bill_exist = await executeInTransaction(
      client,
      `SELECT id FROM purchases 
   WHERE bill_number = $1 
   AND vendor_id = $2 
   AND status != 0`,
      [bill_number, vendor_id]
    );

    if ((is_bill_exist.rowCount ?? 0) > 0) {
      throw new AppError("purchase bill already exist", 400);
    }
    const purchaseQuery = `
    INSERT INTO purchases (
      vendor_id,
      bill_number,
      bill_date,
      subtotal,
      discount,
      net_amount,
      total_cgst,
      total_sgst,
      total_igst,
      final_amount,
      payment_amount,
      notes,
      status,
      remarks,
      payment_method_id,
      transaction_reference,
      firm_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17
    )
    RETURNING *;
  `;

    const values = [
      vendor_id,
      bill_number,
      bill_date,
      subtotal ?? 0,
      discount ?? 0,
      net_amount ?? 0,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      final_amount ?? 0,
      payment_amount ?? 0,
      notes ?? null,
      statusCode,
      JSON.stringify(remark) ?? {},
      payment_method_id ?? null,
      transaction_reference ?? null,
      firm_id
    ];

    const { rows } = await executeInTransaction(client, purchaseQuery, values);
    return rows[0];
  }

  //   async fetchRole(data: FetchRoleParams) {

  //     const { filters, offset } = data;

  //     let where: string[] = [];
  //     let values: any[] = [];
  //     where.push(`status != $${values.length + 1}`);
  //     values.push(0);
  //     if (filters?.id) {
  //       values.push(filters.id);
  //       where.push(`id = $${values.length}`);
  //     }

  //     // if (filters?.status) {
  //     //   values.push(filters.status);
  //     //   where.push(`status = $${values.length}`);
  //     // }

  //     if (filters?.search) {
  //       values.push(`%${filters.search}%`);
  //       where.push(`role ILIKE $${values.length}`);
  //     }
  //     if (filters?.branch_id) {
  //       values.push(filters.branch_id);
  //       where.push(`id = ANY(SELECT unnest(role) FROM branches WHERE id = $${values.length})`);
  //     }
  //     values.push(filters.company_id);
  //     where.push(`company_id = $${values.length}`);

  //     const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  //    const roleQuery = `
  //   SELECT *
  //   FROM role
  //   ${whereClause}
  //   ORDER BY id DESC
  //   LIMIT $${values.length + 1}
  //   OFFSET $${values.length + 2}
  // `;

  //     const countQuery = `
  //       SELECT COUNT(*)
  //       FROM role
  //       ${whereClause}
  //     `;

  //     const roles = await query<FetchDbRole>(
  //       roleQuery,
  //       [...values, filters.limit, offset]
  //     );

  //     const total = await query<RoleCountResult>(countQuery, values);

  //     return {
  //       roles,
  //       pagination: {
  //         page: filters.page,
  //         limit: filters.limit,
  //         total: Number(total[0].count),
  //         totalPages: Math.ceil(Number(total[0].count) / filters.limit),
  //       },
  //     };
  //   }

  //   async updateRole(data: EditRoleParams, client: any) {

  //     const { id, role, description, company_id, statusCode } = data;

  //     const isRoleExist = await isExist(
  //       id,
  //       "role",
  //       "company_id",
  //       company_id,
  //       client
  //     );

  //     if (!isRoleExist) {
  //       throw new AppError("Role not found", 404);
  //     }

  //     const status =
  //       statusCode === 99
  //         ? isRoleExist.status
  //         : statusCode;

  //     const updateQuery = `
  //       UPDATE role
  //       SET
  //         role = $1,
  //         description = $2,
  //         status = $3
  //       WHERE id = $4
  //       RETURNING *;
  //     `;

  //     const values = [
  //       role ?? isRoleExist.role,
  //       description ?? isRoleExist.description,
  //       status,
  //       id
  //     ];

  //     const { rows } = await executeInTransaction(client, updateQuery, values);

  //     return rows[0];
  //   }

  //   async deleteRole(data: DeleteRoleBody) {

  //     const { id, company_id } = data;

  //     const result = transaction(async (client) => {

  //       const isRoleExist = await isExist(
  //         id,
  //         "role",
  //         "company_id",
  //         company_id,
  //         client
  //       );

  //       if (!isRoleExist) {
  //         throw new AppError("Role not found or already deleted", 404);
  //       }

  //       const deleteQuery = `
  //         UPDATE role
  //         SET status = 0
  //         WHERE id = $1
  //         RETURNING *;
  //       `;

  //       const { rows } = await executeInTransaction(
  //         client,
  //         deleteQuery,
  //         [id]
  //       );

  //       return rows[0];
  //     });

  //     return result;
  //   }
}