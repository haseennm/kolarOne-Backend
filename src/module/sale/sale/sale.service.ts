import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord } from "../../../utils/extra";
import { GetReportSalePurchaseLedger, RepayBalanceSale, SaleCreateParams, SaleDeleteParams, SaleEditParams, SaleFetchParams } from "./sale.types";

export default class SaleService {

  async createSale(data: SaleCreateParams, client: PoolClient) {
    const {
      customer_id,
      invoice_date,
      discount,
      final_amount,
      firm_id,
      net_amount,
      payments,
      remark,
      statusCode,
      subtotal,
      paid,
      total_cgst,
      total_igst,
      total_sgst,
      notes,
      branch_id,
      company_id
    } = data;

    // ✅ Firm check
    const is_firm_exist = await getRecord(
      firm_id,
      "firm",
      "branch_id",
      branch_id,
      client
    );
    if (!is_firm_exist) {
      throw new AppError("Firm not found", 404);
    }

    // ✅ Customer check
    const is_customer_exist = await getRecord(
      customer_id,
      "customers",
      "company_id",
      company_id,
      client
    );
    if (!is_customer_exist) {
      throw new AppError("Customer not found", 404);
    }

    // ✅ Validate all payment methods
    if (payments && payments.length > 0) {
      for (const p of payments) {
        const is_payment_method_exist = await getRecord(
          p.payment_method_id,
          "payment_methods",
          "company_id",
          company_id,
          client
        );

        if (!is_payment_method_exist) {
          throw new AppError(
            `Payment method not found: ${p.payment_method_id}`,
            404
          );
        }
      }
    }

    // ✅ Generate invoice number (LOCK)
    const lastInvoice = await executeInTransaction(
      client,
      `
    SELECT invoice_number
    FROM sales
    WHERE firm_id = $1
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
    `,
      [firm_id]
    );

    let nextInvoiceNumber: string;

    if (!lastInvoice.rows.length) {
      nextInvoiceNumber = `INV-0001-${firm_id}`;
    } else {
      const parts = lastInvoice.rows[0].invoice_number.split("-");
      const lastNumber = parts[1] ? parseInt(parts[1], 10) : 0;
      const newNumber = lastNumber + 1;

      nextInvoiceNumber = `INV-${String(newNumber).padStart(4, "0")}-${firm_id}`;
    }

    const invoice_number = nextInvoiceNumber;

    const paymentobj = (payments || []).map((p: any) => ({
      payment_method_id: p.payment_method_id,
      amount: p.amount,
      reference: p.reference ?? null
    }));

    const query = `
    INSERT INTO sales (
      customer_id,
      invoice_number,
      invoice_date,
      subtotal,
      discount,
      net_amount,
      total_cgst,
      total_sgst,
      total_igst,
      final_amount,
      payments,
      notes,
      status,
      remarks,
      firm_id,
      paid
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    )
    RETURNING *;
  `;

    const values = [
      customer_id,
      invoice_number,
      invoice_date,
      subtotal ?? 0,
      discount ?? 0,
      net_amount ?? 0,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      final_amount ?? 0,
      JSON.stringify(paymentobj),
      notes ?? null,
      statusCode,
      JSON.stringify(remark ?? {}),
      firm_id,
      paid
    ];

    const { rows } = await executeInTransaction(client, query, values);

    return rows[0];
  }

  async editSale(data: SaleEditParams, client: PoolClient) {
    const {
      Sale_id,
      customer_id,
      invoice_date,
      discount,
      final_amount,
      firm_id,
      net_amount,
      paid,
      remark,
      statusCode,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      notes,
      branch_id,
      company_id,
      payments
    } = data;

    // ✅ Validation: Check sale existence
    const is_sale_exist = await getRecord(
      Sale_id,
      "sales",
      "firm_id",
      firm_id,
      client
    );
    if (!is_sale_exist) {
      throw new AppError("Sale not found", 404);
    }

    // ✅ Validation: Check customer existence (if updating customer)
    if (customer_id && customer_id !== is_sale_exist.customer_id) {
      const is_customer_exist = await getRecord(
        customer_id,
        "customers",
        "company_id",
        company_id,
        client
      );
      if (!is_customer_exist) {
        throw new AppError("Customer not found", 404);
      }
    }

    // ✅ Validation: Validate all payment methods (if updating payments)
    if (payments && payments.length > 0) {
      for (const p of payments) {
        const is_payment_method_exist = await getRecord(
          p.payment_method_id,
          "payment_methods",
          "company_id",
          company_id,
          client
        );
        if (!is_payment_method_exist) {
          throw new AppError(
            `Payment method not found: ${p.payment_method_id}`,
            404
          );
        }
      }
    }

    // ✅ Build payment object if payments provided
    const paymentobj = payments
      ? (payments || []).map((p: any) => ({
        payment_method_id: p.payment_method_id,
        amount: p.amount,
        reference: p.reference ?? null
      }))
      : (is_sale_exist.payments || []);

    const updateQuery = `
      UPDATE sales SET
        customer_id = $1,
        invoice_date = $2,
        subtotal = $3,
        discount = $4,
        net_amount = $5,
        total_cgst = $6,
        total_sgst = $7,
        total_igst = $8,
        final_amount = $9,
        payments = $10,
        notes = $11,
        status = $12,
        remarks = COALESCE(remarks, '[]'::jsonb) || $13::jsonb,
        paid = $14
      WHERE firm_id = $15 AND id = $16
      RETURNING *;
    `;

    const values = [
      customer_id ?? is_sale_exist.customer_id,
      invoice_date ?? is_sale_exist.invoice_date,
      subtotal ?? is_sale_exist.subtotal,
      discount ?? is_sale_exist.discount,
      net_amount ?? is_sale_exist.net_amount,
      total_cgst ?? is_sale_exist.total_cgst,
      total_sgst ?? is_sale_exist.total_sgst,
      total_igst ?? is_sale_exist.total_igst,
      final_amount ?? is_sale_exist.final_amount,
      JSON.stringify(paymentobj),
      notes ?? is_sale_exist.notes,
      statusCode ?? is_sale_exist.status,
      JSON.stringify([remark]),
      paid ?? is_sale_exist.paid,
      firm_id,
      Sale_id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return rows[0];
  }

  async fetchSale(data: SaleFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // status filter
    where.push(`s.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`s.id = $${values.length}`);
    }

    if (filters?.company_id) {
      values.push(filters.company_id);
      where.push(`b.company_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`f.branch_id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`s.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`s.invoice_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`s.invoice_date <= $${values.length}`);
    }

    // ✅ Updated search (customer_name + invoice_number)
    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      s.invoice_number ILIKE $${values.length}
      OR c.customer_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const saleQuery = `
    SELECT 
      s.*,
      c.customer_name,
      f.branch_id,
      b.company_id
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN firm f ON f.id = s.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
    ORDER BY s.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN firm f ON f.id = s.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

    const sales = await query(
      saleQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      sales,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async fetchSaleFull(data: SaleFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // status filter
    where.push(`s.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`s.id = $${values.length}`);
    }

    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`b.company_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`f.branch_id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`s.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`s.invoice_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`s.invoice_date <= $${values.length}`);
    }

    // ✅ Updated search
    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      s.invoice_number ILIKE $${values.length}
      OR c.customer_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const saleQuery = `
SELECT 
  s.*,
  c.customer_name,
  f.branch_id,
  b.company_id,

  COALESCE(
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', si.id,
        'product_id', si.product_id,
        'product_name', pr.name,
        'stock_id', si.stock_id,
        'batch_number', st.batch_number,
        'saled_qty', si.saled_qty,

        -- ✅ returned qty (correct)
        'returned_qty', (
          SELECT COALESCE(SUM(sri.returned_qty), 0)
          FROM sale_return_items sri
          WHERE sri.sale_item_id = si.id
          AND sri.status != 0
        ),

        -- ✅ remaining qty (BONUS 🔥)
        'remaining_qty', (
          SELECT 
            si.saled_qty - COALESCE(SUM(sri.returned_qty), 0)
          FROM sale_return_items sri
          WHERE sri.sale_item_id = si.id
          AND sri.status != 0
        ),

        'unit', si.unit,
        'unit_price', si.unit_price,
        'sub_total', si.sub_total,
        'discount', si.discount,
        'total_cgst', si.total_cgst,
        'total_sgst', si.total_sgst,
        'total_igst', si.total_igst,
        'net_amount', si.net_amount,
        'final_amount', si.final_amount,
        'status', si.status
      )
    ) FILTER (WHERE si.id IS NOT NULL),
    '[]'
  ) AS items

FROM sales s
LEFT JOIN customers c ON c.id = s.customer_id
LEFT JOIN firm f ON f.id = s.firm_id
LEFT JOIN branches b ON b.id = f.branch_id

-- ✅ correct order
LEFT JOIN sales_items si ON si.sale_id = s.id
LEFT JOIN products pr ON pr.id = si.product_id
LEFT JOIN stock st ON st.id = si.stock_id

${whereClause}

-- ✅ ONLY parent grouping
GROUP BY 
  s.id,
  c.customer_name,
  f.branch_id,
  b.company_id

ORDER BY s.id DESC
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
`;

    const countQuery = `
    SELECT COUNT(*)
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN firm f ON f.id = s.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

    const sales = await query(
      saleQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);
    return {
      sales,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async deleteSale(data: SaleDeleteParams, client: PoolClient) {
    const { id, remark, firm_id } = data;

    const isSaleExist = await getRecord(
      id,
      "Sales",
      "firm_id",
      firm_id,
      client
    );

    if (!isSaleExist) {
      throw new AppError("Sale not found or already deleted", 404);
    }

    // ✅ FIX: await the function
    await this.canDeleteSale(data, client);

    const queryText = `
    UPDATE sales s
    SET
      status = $1,
      remarks =
        CASE
          WHEN s.remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(s.remarks) = 'array'
            THEN s.remarks || $2::jsonb
          ELSE jsonb_build_array(s.remarks) || $2::jsonb
        END
    FROM firm f
    JOIN branches b ON f.branch_id = b.id
    WHERE 
      s.id = $3 
      AND s.firm_id = $4
      AND s.firm_id = f.id
    RETURNING s.*, b.company_id;
  `;

    const values = [
      0,
      JSON.stringify([remark]), // ensure it's an array
      id,
      firm_id
    ];

    const row = await executeInTransaction(client, queryText, values);

    return row.rows[0];
  }
  async canDeleteSale(data: SaleDeleteParams, client: PoolClient) {
    const { id, firm_id } = data;

    const result = await executeInTransaction(
      client,
      `SELECT 1 FROM sale_return 
     WHERE sale_id = $1 
     AND status = $2 
     AND firm_id = $3`,
      [id, 0, firm_id]
    );

    // ✅ FIX: check rows length
    if (result.rows.length > 0) {
      throw new AppError(
        "Sale return already exists for this sale, cannot delete",
        400
      );
    }

    return true;
  }
  async getSalesPurchaseReport(
    client: any,
    {
      level,
      firm_id,
      branch_id,
      company_id,
      start_date,
      end_date
    }: GetReportSalePurchaseLedger
  ) {

    let firmIds: number[] = [];

    /* ========= RESOLVE FIRMS ========= */

    if (level === "Firm" && firm_id) {
      firmIds = [firm_id];
    }

    if (level === "Branch") {
      const res = await client.query(
        `SELECT id FROM firm WHERE branch_id = $1`,
        [branch_id]
      );
      firmIds = res.rows.map((r: any) => r.id);
    }

    if (level === "Company") {
      const res = await client.query(
        `SELECT f.id
       FROM firm f
       JOIN branches b ON b.id = f.branch_id
       WHERE b.company_id = $1`,
        [company_id]
      );
      firmIds = res.rows.map((r: any) => r.id);
    }

    if (!firmIds.length) return [];
    /* ========= DATE FILTER ========= */

    let dateFilter = "";
    let params: any[] = [firmIds];
    let idx = 2;

    // Parse and normalize dates so type comparison works as expected,
    // and make end_date inclusive for the full day.
    if (start_date) {
      const parsedStart = new Date(start_date);
      if (Number.isNaN(parsedStart.getTime())) {
        throw new AppError("Invalid start_date format. Use YYYY-MM-DD.", 400);
      }
      // compare using date portion only so timestamp offsets don't fail.
      dateFilter += ` AND main_date::date >= $${idx++}`;
      params.push(parsedStart.toISOString().slice(0, 10));
    }

    if (end_date) {
      const parsedEnd = new Date(end_date);
      if (Number.isNaN(parsedEnd.getTime())) {
        throw new AppError("Invalid end_date format. Use YYYY-MM-DD.", 400);
      }
      // inclusive end of day by comparing dates
      dateFilter += ` AND main_date::date <= $${idx++}`;
      params.push(parsedEnd.toISOString().slice(0, 10));
    }

    /* ========= MAIN QUERY ========= */

    const query = `
    SELECT * FROM (
  SELECT
        'sale' AS type,
        s.id,
        s.invoice_date AS date,
        s.final_amount AS amount,
        s.invoice_number AS invoice,
        s.invoice_date AS main_date
      FROM sales s
      WHERE s.firm_id = ANY($1::int[])
        AND s.status != 0

      UNION ALL
      SELECT
        'purchase' AS type,
        p.id,
        p.bill_date AS date,
        -p.final_amount AS amount,
        p.bill_number AS invoice,
        p.bill_date AS main_date
      FROM purchases p
      WHERE p.firm_id = ANY($1::int[])
        AND p.status != 0

      UNION ALL

      -- SALES RETURN
      SELECT
        'sales_return' AS type,
        sr.id,
        sr.return_date AS date,
        -sr.final_amount AS amount,
        sr.return_number AS invoice,
        sr.return_date AS main_date
      FROM sale_return sr
      WHERE sr.firm_id = ANY($1::int[])
        AND sr.status != 0

      UNION ALL

      -- PURCHASE RETURN
      SELECT
        'purchase_return' AS type,
        pr.id,
        pr.return_date AS date,
        pr.final_amount AS amount,
        pr.return_number AS invoice,
        pr.return_date AS main_date
      FROM purchase_return pr
      WHERE pr.firm_id = ANY($1::int[])
        AND pr.status != 0

    ) t
    WHERE 1=1 ${dateFilter}
    ORDER BY date DESC
  `;
    const { rows } = await client.query(query, params);
    return rows;
  }

  async updateSalePayment(
    data: RepayBalanceSale,
    client: PoolClient
  ) {
    const { firm_id, payments, remark, sale_id, company_id } = data
    const is_sale_exist = await getRecord(
      sale_id,
      "sales",
      "firm_id",
      firm_id,
      client
    );

    if (!is_sale_exist) {
      throw new AppError("Sale not found", 404);
    }

    // ✅ Validate payment methods
    for (const p of payments) {
      const is_payment_method_exist = await getRecord(
        p.payment_method_id,
        "payment_methods",
        "company_id",
        company_id, // safer
        client
      );

      if (!is_payment_method_exist) {
        throw new AppError(
          `Payment method not found: ${p.payment_method_id}`,
          404
        );
      }
    }

    // ✅ Calculate new paid amount
    const newPaid =
      (Number(is_sale_exist.paid) || 0) +
      payments.reduce((sum, p) => sum + p.amount, 0);
    console.log("newPaid", newPaid)
    const paymentObj = payments.map((p) => ({
      payment_method_id: p.payment_method_id,
      amount: p.amount,
      reference: p.reference_number ?? null
    }));

    const query = `
    UPDATE sales
    SET 
      payments = COALESCE(payments, '[]'::jsonb) || $1::jsonb,
      paid = $2,
      remarks = COALESCE(remarks, '[]'::jsonb) || $3::jsonb
    WHERE id = $4 AND firm_id = $5
    RETURNING *;
  `;

    const values = [
      JSON.stringify(paymentObj),  // append array
      newPaid,
      JSON.stringify([remark]),    // keep consistent with purchase
      sale_id,
      firm_id
    ];

    const { rows } = await executeInTransaction(client, query, values);

    return rows[0];
  }
}