import { executeInTransaction, query, transaction } from "../../config/db";
import { isExist } from "../../utils/extra";
import {
  CountResult,
  CreateCustomerParams,
  DeleteCustomerParams,
  EditCustomerParams,
  FetchCustomerParams,
  FetchDbCustomer,
} from "./customer.types";
import { AppError } from "../../utils/AppError";

export default class CustomerService {

  async createCustomer(data: CreateCustomerParams) {

    const {
      company_id,
      customer_type,
      customer_name,
      gender,
      email,
      phone_number,
      alternate_phone,
      billing_address,
      billing_district,
      billing_state,
      billing_pin,
      shipping_address,
      shipping_district,
      shipping_state,
      shipping_pin,
      state_code,
      gstin,
      notes,
      statusCode,
      remark
    } = data;

    const result = transaction(async (client) => {

      const isCompanyExist = await isExist(
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
      INSERT INTO customers (
        company_id,
        customer_type,
        customer_name,
        gender,
        email,
        phone_number,
        alternate_phone,
        billing_address,
        billing_district,
        billing_state,
        billing_pin,
        shipping_address,
        shipping_district,
        shipping_state,
        shipping_pin,
        state_code,
        gstin,
        notes,
        status,
        remarks
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      )
      RETURNING *;
      `;

      const values = [
        company_id,
        customer_type,
        customer_name,
        gender,
        email,
        phone_number,
        alternate_phone,
        billing_address,
        billing_district,
        billing_state,
        billing_pin,
        shipping_address,
        shipping_district,
        shipping_state,
        shipping_pin,
        state_code,
        gstin || null,
        notes || null,
        statusCode,
        JSON.stringify(remark)
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return `User ${rows[0].customer_name} created`;
    });

    return result;
  }

  async fetchCustomer(data: FetchCustomerParams) {

    const { filters = {} } = data;

    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters?.search) {

      values.push(`%${filters.search}%`);
      const index = values.length;

      where.push(`
      (
        customer_name ILIKE $${index}
        OR phone_number ILIKE $${index}
        OR email ILIKE $${index}
        OR gstin ILIKE $${index}
      )
      `);
    }

    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters?.company_id) {
      values.push(filters.company_id);
      where.push(`company_id = $${values.length}`);
    }

    if (filters?.customer_type) {
      values.push(filters.customer_type);
      where.push(`customer_type = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const customerQuery = `
      SELECT * FROM customers
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM customers
      ${whereClause}
    `;

    const customers = await query<FetchDbCustomer>(
      customerQuery,
      [...values, limit, offset]
    );

    const total = await query<CountResult>(countQuery, values);

    return {
      customers,
      page,
      limit,
      total: Number(total[0].count),
    };
  }

  async updateCustomer(data: EditCustomerParams) {

    const {
      id,
      company_id,
      customer_type,
      customer_name,
      gender,
      email,
      phone_number,
      alternate_phone,
      billing_address,
      billing_district,
      billing_state,
      billing_pin,
      shipping_address,
      shipping_district,
      shipping_state,
      shipping_pin,
      state_code,
      gstin,
      notes,
      statusCode,
      remark
    } = data;

    const result = transaction(async (client) => {

      const isCustomerExist = await isExist(
        id,
        "customers",
        "company_id",
        company_id,
        client
      );

      if (!isCustomerExist) {
        throw new AppError("Customer not found", 404);
      }

      const queryText = `
      UPDATE customers
      SET
        customer_type = $1,
        customer_name = $2,
        gender = $3,
        email = $4,
        phone_number = $5,
        alternate_phone = $6,
        billing_address = $7,
        billing_district = $8,
        billing_state = $9,
        billing_pin = $10,
        shipping_address = $11,
        shipping_district = $12,
        shipping_state = $13,
        shipping_pin = $14,
        state_code = $15,
        gstin = $16,
        notes = $17,
        status = $18,
        remarks =
          CASE
            WHEN remarks IS NULL THEN $19::jsonb
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $19::jsonb
            ELSE jsonb_build_array(remarks) || $19::jsonb
          END
      WHERE id = $20
      RETURNING *;
      `;

      const values = [
        customer_type ?? isCustomerExist.customer_type,
        customer_name ?? isCustomerExist.customer_name,
        gender ?? isCustomerExist.gender,
        email ?? isCustomerExist.email,
        phone_number ?? isCustomerExist.phone_number,
        alternate_phone ?? isCustomerExist.alternate_phone,
        billing_address ?? isCustomerExist.billing_address,
        billing_district ?? isCustomerExist.billing_district,
        billing_state ?? isCustomerExist.billing_state,
        billing_pin ?? isCustomerExist.billing_pin,
        shipping_address ?? isCustomerExist.shipping_address,
        shipping_district ?? isCustomerExist.shipping_district,
        shipping_state ?? isCustomerExist.shipping_state,
        shipping_pin ?? isCustomerExist.shipping_pin,
        state_code ?? isCustomerExist.state_code,
        gstin ?? isCustomerExist.gstin,
        notes ?? isCustomerExist.notes,
        statusCode ?? isCustomerExist.status,
        JSON.stringify(remark),
        id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return rows[0];
    });

    return result;
  }

  async deleteCustomer(data: DeleteCustomerParams) {

    const { r_id, remark, company_id } = data;

    const result = transaction(async (client) => {

      const isCustomerExist = await isExist(
        r_id,
        "customers",
        "company_id",
        company_id,
        client
      );

      if (!isCustomerExist) {
        throw new AppError("Customer not found or already deleted", 404);
      }

      const queryText = `
      UPDATE customers
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

      await executeInTransaction(client, queryText, values);

      return `Customer ${isCustomerExist.customer_name} deleted successfully`;
    });

    return result;
  }

}