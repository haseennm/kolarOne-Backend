import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";
import { buildAuditChanges } from "../journal/journal.utils";

import {
  CreatePaymentMethodParams,
  DeletePaymentMethodBody,
  CountResult,
  EditPaymentMethodParams,
  FetchPaymentMethodParams,
  FetchDbPaymentMethod
} from "./paymentMethod.types";

export default class PaymentMethodService {

  async createPaymentMethod(data: CreatePaymentMethodParams, client?: any) {

    const {
      name,
      company_id,
      statusCode,
      created_by,
      note
    } = data;

    const runCreate = async (txClient: any) => {

      const isCompanyExist = await getRecord(
        company_id,
        "company",
        "id",
        company_id,
        txClient
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

      const { rows } = await executeInTransaction(txClient, queryText, values);

      return rows[0];
    };

    if (client) return runCreate(client);
    return transaction(runCreate);
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

  async updatePaymentMethod(data: EditPaymentMethodParams, client?: any) {

    const {
      id,
      company_id,
      name,
      note,
      statusCode,
      updated_by
    } = data;

    const runUpdate = async (txClient: any) => {

      const isPaymentMethodExist = await getRecord(
        id,
        "payment_methods",
        "company_id",
        company_id,
        txClient
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

      const { rows } = await executeInTransaction(txClient, queryText, values);
      const updatedPaymentMethod = rows[0];
      const changes = buildAuditChanges(isPaymentMethodExist, updatedPaymentMethod);
      return { data: updatedPaymentMethod, changes };
    };

    if (client) return runUpdate(client);
    return transaction(runUpdate);
  }

  async deletePaymentMethod(data: DeletePaymentMethodBody, client?: any) {

    const { r_id, company_id, deleted_by } = data;

    const runDelete = async (txClient: any) => {

      const isPaymentMethodExist = await getRecord(
        r_id,
        "payment_methods",
        "company_id",
        company_id,
        txClient
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

      const { rows } = await executeInTransaction(txClient, queryText, values);
      return rows[0];
    };

    if (client) return runDelete(client);
    return transaction(runDelete);
  }

}