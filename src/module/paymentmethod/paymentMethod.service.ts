import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";

import {
  CreatePaymentMethodParams,
  DeletePaymentMethodBody,
  CountResult,
  EditPaymentMethodParams,
  FetchPaymentMethodParams,
  FetchDbPaymentMethod
} from "./paymentMethod.types";

export default class PaymentMethodService {

  async createPaymentMethod(data: CreatePaymentMethodParams) {

    const {
      name,
      company_id,
      statusCode,
      created_by,
      note
    } = data;

    const result = transaction(async (client) => {

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

      const queryText = `
        INSERT INTO payment_methods (
          method_name,
          company_id,
          status,
          note
        )
        VALUES ($1,$2,$3,$4)
        RETURNING *;
      `;

      const values = [
        name,
        company_id,
        statusCode,
        note ?? null
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return `Payment Method ${rows[0].method_name} created`;
    });

    return result;
  }

  async fetchPaymentMethod(data: FetchPaymentMethodParams) {

    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      const index = values.length;
      where.push(`
        (
          method_name ILIKE $${index}
        )
      `);
    }

    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    values.push(filters.company_id);
    where.push(`company_id = $${values.length}`);

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const paymentMethodQuery = `
      SELECT *
      FROM payment_methods
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM payment_methods
      ${whereClause}
    `;

    const paymentMethods = await query<FetchDbPaymentMethod>(
      paymentMethodQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<CountResult>(countQuery, values);

    return {
      paymentMethods,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }

  async updatePaymentMethod(data: EditPaymentMethodParams) {

    const {
      id,
      company_id,
      name,
      note,
      statusCode,
      updated_by
    } = data;

    const result = transaction(async (client) => {

      const isPaymentMethodExist = await getRecord(
        id,
        "payment_methods",
        "company_id",
        company_id,
        client
      );

      if (!isPaymentMethodExist) {
        throw new AppError("Payment method not found", 404);
      }

      const queryText = `
        UPDATE payment_methods
        SET
          method_name = $1,
          note = $2,
          status = $3
        WHERE id = $4
        RETURNING *;
      `;

      const status =
        statusCode === 99
          ? isPaymentMethodExist.status
          : statusCode;

      const values = [
        name ?? isPaymentMethodExist.method_name,
        note ?? isPaymentMethodExist.note,
        status,
        id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return `Payment Method ${rows[0].method_name} Updated`;
    });

    return result;
  }

  async deletePaymentMethod(data: DeletePaymentMethodBody) {

    const { r_id, company_id, deleted_by } = data;

    const result = transaction(async (client) => {

      const isPaymentMethodExist = await getRecord(
        r_id,
        "payment_methods",
        "company_id",
        company_id,
        client
      );

      if (!isPaymentMethodExist) {
        throw new AppError("Payment method not found or already deleted", 404);
      }

      const queryText = `
        UPDATE payment_methods
        SET
          status = $1
        WHERE id = $2 AND company_id =$3
        RETURNING *;
      `;

      const values = [
        0,
        r_id,
        company_id
      ];

      await executeInTransaction(client, queryText, values);

      return `Payment Method ${isPaymentMethodExist.method_name} deleted successfully`;
    });

    return result;
  }

}