import { executeInTransaction, query, transaction } from "../../config/db";
import { getRecord } from "../../utils/extra";
import {
  CountResult,
  CreateCustomerParams,
  DeleteCustomerParams,
  EditCustomerParams,
  FetchCustomerParams,
  FetchDbCustomer,
  GetCustomerReport,
} from "./customer.types";
import { AppError } from "../../utils/AppError";
import { buildAuditChanges } from "../journal/journal.utils";

export default class CustomerService {

  async createCustomer(data: CreateCustomerParams): Promise<any> {

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
      remark,
      credit_days,
      credit_limit
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
        remarks,
        credit_days,
        credit_limit
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
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
        JSON.stringify(remark),
        credit_days || 10,
        credit_limit || 10000
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return rows[0];
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

  if (filters?.status !== undefined) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }

  const whereClause = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

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

  // SALE VALIDATION
  if (filters?.is_sale) {

    for (const customer of customers) {

      const balanceQuery = `
        SELECT
          COALESCE(SUM(pb.balance), 0) AS current_credit,
          MIN(pb.updated_at) AS earliest_date
        FROM party_balance pb

        LEFT JOIN sales s
          ON pb.ref_type = 'S'
          AND pb.ref_id = s.id

        LEFT JOIN sale_return sr
          ON pb.ref_type = 'SR'
          AND pb.ref_id = sr.id

        LEFT JOIN sales s_sr
          ON sr.sale_id = s_sr.id

        WHERE
          pb.balance > 0
          AND pb.flow = 'I'
          AND pb.status != 0
          AND (
            s.customer_id = $1
            OR s_sr.customer_id = $1
          )
      `;

      const balanceResult = await query(balanceQuery, [customer.id]);

      const currentCredit = Number(
        balanceResult[0]?.current_credit ?? 0
      );

      const earliestDate = balanceResult[0]?.earliest_date;

      customer.can_sale = true;

      // CREDIT DAYS VALIDATION
      if (earliestDate && customer.credit_days > 0) {

        const today = new Date();

        const oldDate = new Date(earliestDate);

        const diffTime = today.getTime() - oldDate.getTime();

        const reachedDays = Math.floor(
          diffTime / (1000 * 60 * 60 * 24)
        );

        if (reachedDays > customer.credit_days) {

          customer.can_sale = false;

          customer.reason =
            `Cannot make sale due to exceeded credit days. ` +
            `Customer credit days is ${customer.credit_days} ` +
            `and reached days is ${reachedDays}`;

          continue;
        }
      }

      // CREDIT LIMIT VALIDATION
      if (
        customer.credit_limit > 0 &&
        currentCredit > customer.credit_limit
      ) {

        customer.can_sale = false;

        customer.reason =
          `Cannot make sale. Customer credit limit is ` +
          `${customer.credit_limit} and current due is ${currentCredit}`;
      }
    }
  }

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
      remark,
      credit_days,
      credit_limit
    } = data;

    const result = transaction(async (client) => {

      const isCustomerExist = await getRecord(
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
          END,
          credit_days=$20,
          credit_limit=$21
      WHERE id = $22
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
        credit_days ?? isCustomerExist.credit_days,
        credit_limit ?? isCustomerExist.credit_limit,
        id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);
      const updatedCustomer = rows[0];
      const changes = buildAuditChanges(isCustomerExist, updatedCustomer);

      return { data: updatedCustomer, changes };
    });

    return result;
  }

  async deleteCustomer(data: DeleteCustomerParams) {

    const { r_id, remark, company_id } = data;

    const result = transaction(async (client) => {

      const isCustomerExist = await getRecord(
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

      const { rows } = await executeInTransaction(client, queryText, values);

      return rows[0];
    });

    return result;
  }
  async getCustomerReportSummary(data: GetCustomerReport) {

    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {

      let firmIds: number[] = [];

      /* ================= GET FIRM IDS ================= */

      if (level === "firm") {
        firmIds = [firm_id!];
      }

      if (level === "branch") {
        const firms = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = firms.rows.map((f: any) => f.id);
      }

      if (level === "company") {
        const firms = await executeInTransaction(
          client,
          `
          SELECT f.id
          FROM firm f
          JOIN branches b ON b.id = f.branch_id
          WHERE b.company_id = $1
          `,
          [company_id]
        );
        firmIds = firms.rows.map((f: any) => f.id);
      }

      if (!firmIds.length) return {};

      /* ================= MAIN REPORT ================= */

      const report = await this.getCustomerReportByFirms(
        client,
        firmIds,
        start_date,
        end_date
      );

      /* ================= COMPANY EXTRA ================= */

      if (level === "company") {

        const branchWise = await executeInTransaction(
          client,
          `
          SELECT 
            b.id AS branch_id,
            b.branch_name,
            SUM(s.final_amount) AS total_sales
          FROM branches b
          JOIN firm f ON f.branch_id = b.id
          JOIN sales s ON s.firm_id = f.id
          WHERE b.company_id = $1
          GROUP BY b.id
          `,
          [company_id]
        );

        const firmWise = await executeInTransaction(
          client,
          `
          SELECT 
            f.id AS firm_id,
            f.firm_name,
            SUM(s.final_amount) AS total_sales
          FROM firm f
          JOIN sales s ON s.firm_id = f.id
          WHERE f.id = ANY($1)
          GROUP BY f.id
          `,
          [firmIds]
        );

        return {
          overall: report,
          branch_wise: branchWise.rows,
          firm_wise: firmWise.rows
        };
      }

      return report;
    });
  }

  /* ============================================================ */

  private async getCustomerReportByFirms(
    client: any,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {
    const hasDate = Boolean(startDate && endDate);

    const salesDate = hasDate
      ? `AND s.invoice_date BETWEEN $2 AND $3`
      : "";

    const returnDate = hasDate
      ? `AND sr.return_date BETWEEN $2 AND $3`
      : "";

    const params = hasDate
      ? [firmIds, startDate, endDate]
      : [firmIds];

    /* ================= SALES ================= */

    // 1. Most items sold (count)
    const mostItemsSold = await executeInTransaction(
      client,
      `
    SELECT 
      c.id AS customer_id,
      c.customer_name,
      COUNT(si.id) AS total_items
    FROM customers c
    JOIN sales s 
      ON s.customer_id = c.id
     AND s.status != 0
     AND s.firm_id = ANY($1)

    JOIN sales_items si 
      ON si.sale_id = s.id
     AND si.status != 0
     AND si.firm_id = ANY($1)

    ${salesDate}

    GROUP BY c.id, c.customer_name
    ORDER BY total_items DESC
    `,
      params
    );

    // 2. Most amount spent
    const mostAmount = await executeInTransaction(
      client,
      `
    SELECT 
      c.id AS customer_id,
      c.customer_name,
      SUM(s.final_amount) AS total_amount
    FROM customers c
    JOIN sales s 
      ON s.customer_id = c.id
     AND s.status = 4
     AND s.firm_id = ANY($1)

    ${salesDate}

    GROUP BY c.id, c.customer_name
    ORDER BY total_amount DESC
    `,
      params
    );

    // 3. Most quantity sold
    const mostQuantity = await executeInTransaction(
      client,
      `
    SELECT 
      c.id AS customer_id,
      c.customer_name,
      SUM(si.saled_qty) AS total_quantity
    FROM customers c
    JOIN sales s 
      ON s.customer_id = c.id
     AND s.status != 0
     AND s.firm_id = ANY($1)

    JOIN sales_items si 
      ON si.sale_id = s.id
     AND si.status != 0
     AND si.firm_id = ANY($1)

    ${salesDate}

    GROUP BY c.id, c.customer_name
    ORDER BY total_quantity DESC
    `,
      params
    );

    // 4. Customers with pending balance
    const customersWithBalance = await executeInTransaction(
      client,
      `
    SELECT 
      COUNT(DISTINCT c.id) AS total_customers_with_balance
    FROM customers c
    JOIN sales s 
      ON s.customer_id = c.id
     AND s.status = 4
     AND s.firm_id = ANY($1)
     AND s.final_amount > s.paid

    ${salesDate}
    `,
      params
    );

    /* ================= RETURN ================= */

    // 5. Most items returned
    const mostReturnItems = await executeInTransaction(
      client,
      `
    SELECT 
      c.id AS customer_id,
      c.customer_name,
      COUNT(sri.id) AS total_items
    FROM customers c
    JOIN sales s 
      ON s.customer_id = c.id
     AND s.firm_id = ANY($1)

    JOIN sale_return sr 
      ON sr.sale_id = s.id
     AND sr.status != 0
     AND sr.firm_id = ANY($1)

    JOIN sale_return_items sri 
      ON sri.sale_return_id = sr.id
     AND sri.status != 0
     AND sri.firm_id = ANY($1)

    ${returnDate}

    GROUP BY c.id, c.customer_name
    ORDER BY total_items DESC
    `,
      params
    );

    // 6. Most return amount
    const mostReturnAmount = await executeInTransaction(
      client,
      `
    SELECT 
      c.id AS customer_id,
      c.customer_name,
      SUM(sr.final_amount) AS total_amount
    FROM customers c
    JOIN sales s 
      ON s.customer_id = c.id
     AND s.firm_id = ANY($1)

    JOIN sale_return sr 
      ON sr.sale_id = s.id
     AND sr.status != 0
     AND sr.firm_id = ANY($1)

    ${returnDate}

    GROUP BY c.id, c.customer_name
    ORDER BY total_amount DESC
    `,
      params
    );

    // 7. Most return quantity
    const mostReturnQuantity = await executeInTransaction(
      client,
      `
    SELECT 
      c.id AS customer_id,
      c.customer_name,
      SUM(sri.returned_qty) AS total_quantity
    FROM customers c
    JOIN sales s 
      ON s.customer_id = c.id
     AND s.firm_id = ANY($1)

    JOIN sale_return sr 
      ON sr.sale_id = s.id
     AND sr.status != 0
     AND sr.firm_id = ANY($1)

    JOIN sale_return_items sri 
      ON sri.sale_return_id = sr.id
     AND sri.status != 0
     AND sri.firm_id = ANY($1)

    ${returnDate}

    GROUP BY c.id, c.customer_name
    ORDER BY total_quantity DESC
    `,
      params
    );

    return {
      sales: {
        most_items: mostItemsSold.rows,
        most_amount: mostAmount.rows,
        most_quantity: mostQuantity.rows,
        customers_with_balance:
          customersWithBalance.rows[0]?.total_customers_with_balance || 0
      },
      return: {
        most_items: mostReturnItems.rows,
        most_amount: mostReturnAmount.rows,
        most_quantity: mostReturnQuantity.rows
      }
    };
  }
}