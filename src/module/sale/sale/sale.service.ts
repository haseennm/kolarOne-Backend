import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord, getStatusCode } from "../../../utils/extra";
import { GetReportSalePurchaseLedger, RepayBalanceSale, SaleCreateParams, SaleDeleteParams, SaleEditParams, SaleFetchParams } from "./sale.types";
import { buildAuditChanges } from "../../journal/journal.utils";

export default class SaleService {
  private billStatus(final_amount: number, paid_amount: number) {
    if (paid_amount <= 0) {
      return getStatusCode("Unpaid");
    }
    if (paid_amount == final_amount) {
      return getStatusCode("Paid");
    }
    if (paid_amount > final_amount) {
      return getStatusCode("Over Pay");
    }
    return getStatusCode("Partial");
  }
  async createSale(data: SaleCreateParams, client: PoolClient) {
    const {
      customer_id,
      invoice_date,
      discount,
      final_amount,
      firm_id,
      net_amount,
      payments, // Incoming stringified JSON string payload from controller
      remark,
      subtotal,
      paid,
      total_cgst,
      total_igst,
      total_sgst,
      notes,
      branch_id,
      company_id,
      price_pool,
      is_intrastate,
      state_code,
      courier_charge,
      handling_charge,
      other_charge
    } = data;

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

    // ✅ Extract and validate child items before committing stringify serialization arrays
    const parsedPayments = typeof payments === "string" ? JSON.parse(payments) : payments;

    if (parsedPayments && parsedPayments.length > 0) {
      for (const p of parsedPayments) {
        if (p.payment_method_id) {
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
    }

    // ✅ Auto-Generate Locking Sequence Invoice IDs
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
    const refResult = await executeInTransaction(
      client,
      `SELECT CONCAT('SL-', nextval('sale_ref_seq')) AS ref`
    );

    const status = this.billStatus(final_amount, paid);
    const ref_no = refResult.rows[0].ref;

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
      paid,
      ref_no,
      price_pool,
      is_intrastate,
      state_code,
      courier_charge,
      handling_charge,
      other_charge
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
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
      typeof payments === "string" ? payments : JSON.stringify(payments), // Inserts safe text payload block mapping array
      notes ?? null,
      status,
      JSON.stringify(remark ?? {}),
      firm_id,
      paid ?? 0,
      ref_no,
      price_pool,
      is_intrastate,
      state_code,
      courier_charge ?? 0,
      handling_charge ?? 0,
      other_charge ?? 0
    ];

    const { rows } = await executeInTransaction(client, query, values);
    return rows[0];
  }

  // async editSale(data: SaleEditParams, client: PoolClient) {
  //   const {
  //     Sale_id,
  //     customer_id,
  //     invoice_date,
  //     discount,
  //     final_amount,
  //     firm_id,
  //     net_amount,
  //     paid,
  //     remark,
  //     subtotal,
  //     total_cgst,
  //     total_igst,
  //     total_sgst,
  //     notes,
  //     branch_id,
  //     company_id,
  //     payments,
  //     courier_charge,
  //     handling_charge, other_charge
  //   } = data;

  //   // ✅ Validation: Check sale existence
  //   const is_sale_exist = await getRecord(
  //     Sale_id,
  //     "sales",
  //     "firm_id",
  //     firm_id,
  //     client
  //   );
  //   if (!is_sale_exist) {
  //     throw new AppError("Sale not found", 404);
  //   }

  //   // ✅ Validation: Check customer existence (if updating customer)
  //   if (customer_id && customer_id !== is_sale_exist.customer_id) {
  //     const is_customer_exist = await getRecord(
  //       customer_id,
  //       "customers",
  //       "company_id",
  //       company_id,
  //       client
  //     );
  //     if (!is_customer_exist) {
  //       throw new AppError("Customer not found", 404);
  //     }
  //   }

  //   // ✅ Validation: Validate all payment methods (if updating payments)
  //   if (payments && payments.length > 0) {
  //     for (const p of payments) {
  //       const is_payment_method_exist = await getRecord(
  //         p.payment_method_id,
  //         "payment_methods",
  //         "company_id",
  //         company_id,
  //         client
  //       );
  //       if (!is_payment_method_exist) {
  //         throw new AppError(
  //           `Payment method not found: ${p.payment_method_id}`,
  //           404
  //         );
  //       }
  //     }
  //   }

  //   // ✅ Build payment object if payments provided
  //   const paymentobj = payments
  //     ? (payments || []).map((p: any) => ({
  //       payment_method_id: p.payment_method_id,
  //       amount: p.amount,
  //       reference: p.reference ?? null
  //     }))
  //     : (is_sale_exist.payments || []);
  //   const status = this.billStatus((final_amount ?? is_sale_exist.final_amount), (paid ?? is_sale_exist.paid))

  //   const updateQuery = `
  //     UPDATE sales SET
  //       customer_id = $1,
  //       invoice_date = $2,
  //       subtotal = $3,
  //       discount = $4,
  //       net_amount = $5,
  //       total_cgst = $6,
  //       total_sgst = $7,
  //       total_igst = $8,
  //       final_amount = $9,
  //       payments = $10,
  //       notes = $11,
  //       status = $12,
  //       remarks = CASE
  //       WHEN remarks IS NULL THEN $13::jsonb
  //       WHEN jsonb_typeof(remarks) = 'array'
  //         THEN remarks || $13::jsonb
  //       ELSE jsonb_build_array(remarks) || $13::jsonb
  //     END,
  //       paid = $14,
  //       courier_charge =$15
  //     handling_charge= $16
  //     other_charge= $17
  //     WHERE firm_id = $18 AND id = $19
  //     RETURNING *;
  //   `;

  //   const values = [
  //     customer_id ?? is_sale_exist.customer_id,
  //     invoice_date ?? is_sale_exist.invoice_date,
  //     subtotal ?? is_sale_exist.subtotal,
  //     discount ?? is_sale_exist.discount,
  //     net_amount ?? is_sale_exist.net_amount,
  //     total_cgst ?? is_sale_exist.total_cgst,
  //     total_sgst ?? is_sale_exist.total_sgst,
  //     total_igst ?? is_sale_exist.total_igst,
  //     final_amount ?? is_sale_exist.final_amount,
  //     JSON.stringify(paymentobj),
  //     notes ?? is_sale_exist.notes,
  //     status,
  //     JSON.stringify([remark]),
  //     paid ?? is_sale_exist.paid,
  //     courier_charge ?? is_sale_exist.courier_charge,
  //     handling_charge ?? is_sale_exist.handling_charge,
  //     other_charge ?? is_sale_exist.other_charge,
  //     firm_id,
  //     Sale_id
  //   ];

  //   const { rows } = await executeInTransaction(client, updateQuery, values);
  //   return rows[0];
  // }
  async editSale(data: SaleEditParams, client: PoolClient) {
    const {
      invoice_date,
      invoice_number,
      discount,
      final_amount,
      firm_id,
      net_amount,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      customer_id,
      notes,
      branch_id,
      company_id,
      sale_id,
      courier_charge,
      handling_charge,
      other_charge,
      ref_no,
      price_pool,
      is_intrastate,
      state_code,
      remark,
      computed_payment_amount,
      merged_payments_json
    } = data;

    // 1. Fetch record with Row Lock (Pessimistic Locking)
    const queryExisting = await executeInTransaction(
      client,
      `SELECT * FROM sales WHERE id = $1 AND firm_id = $2 FOR UPDATE;`,
      [sale_id, firm_id]
    );

    const is_sale_exist = queryExisting.rows[0];
    if (!is_sale_exist) {
      throw new AppError("Sale invoice not found", 404);
    }

    // 2. Unique Constraints Validation
    if (invoice_number && invoice_number !== is_sale_exist.invoice_number) {
      const activeCustomer = customer_id ?? is_sale_exist.customer_id;
      const is_invoice_exist = await executeInTransaction(
        client,
        `SELECT id FROM sales WHERE invoice_number = $1 AND customer_id = $2 AND status != 'Cancelled' AND id != $3`,
        [invoice_number, activeCustomer, sale_id]
      );
      if ((is_invoice_exist.rowCount ?? 0) > 0) {
        throw new AppError("Invoice number sequence already exists for this client", 400);
      }
    }

    // 3. Perform atomic update matching your target schema layout matrix fields
    const saleQuery = `
      UPDATE sales SET
        customer_id = $1,
        invoice_number = $2,
        invoice_date = $3,
        subtotal = $4,
        discount = $5,
        net_amount = $6,
        total_cgst = $7,
        total_sgst = $8,
        total_igst = $9,
        final_amount = $10,
        paid = $11, -- ✅ Maps total computed payments to your custom schema 'paid' column
        notes = $12,
        status = $13,
        remarks = CASE
          WHEN remarks IS NULL THEN $14::jsonb
          WHEN jsonb_typeof(remarks) = 'array' THEN remarks || $14::jsonb
          ELSE jsonb_build_array(remarks) || $14::jsonb
        END,
        payments = $15,
        courier_charge = $16,
        handling_charge = $17,
        other_charge = $18,
        ref_no = $19,
        price_pool = $20,
        is_intrastate = $21,
        state_code = $22
      WHERE firm_id = $23 AND id = $24
      RETURNING *;
    `;

    const targetFinalAmount = final_amount ?? is_sale_exist.final_amount;

    const values = [
      customer_id ?? is_sale_exist.customer_id,
      invoice_number ?? is_sale_exist.invoice_number,
      invoice_date ?? is_sale_exist.invoice_date,
      subtotal ?? is_sale_exist.subtotal,
      discount ?? is_sale_exist.discount,
      net_amount ?? is_sale_exist.net_amount,
      total_cgst ?? is_sale_exist.total_cgst,
      total_sgst ?? is_sale_exist.total_sgst,
      total_igst ?? is_sale_exist.total_igst,
      targetFinalAmount,
      computed_payment_amount,
      notes ?? is_sale_exist.notes,
      status ?? is_sale_exist.status,
      JSON.stringify([remark]),
      merged_payments_json,
      courier_charge ?? is_sale_exist.courier_charge,
      handling_charge ?? is_sale_exist.handling_charge,
      other_charge ?? is_sale_exist.other_charge,
      ref_no ?? is_sale_exist.ref_no,
      price_pool ?? is_sale_exist.price_pool,
      is_intrastate ?? is_sale_exist.is_intrastate,
      state_code ?? is_sale_exist.state_code,
      firm_id,
      sale_id
    ];

    const { rows } = await executeInTransaction(client, saleQuery, values);
    const changes = buildAuditChanges(is_sale_exist, rows[0]);
    return {
      changes,
      data: rows[0]
    };
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
  ) AS items,
 (
              SELECT COALESCE(
                  JSON_AGG(
                      JSON_BUILD_OBJECT(
                          'id', pt.id,
                          'payment_method_id', pt.payment_method_id,
                          'payment_method', pm2.method_name,
                          'amount', pt.amount,
                          'payment_flow', pt.payment_flow,
                          'transaction_date', pt.created_at,
                          'transaction_reference', pt.transaction_reference
                      )
                      ORDER BY pt.id
                  ),
                  '[]'
              )
              FROM payment_transactions pt
              LEFT JOIN payment_methods pm2
                  ON pm2.id = pt.payment_method_id
              WHERE pt.ref_id = s.id
                AND pt.ref_type = 'SL'
          ) AS payments
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
     const { firm_id, payments, sale_id, remark, company_id, payment_flow } = data;
     // 1. Fetch record first to check existence
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
 
     // 2. Validate payment methods
     for (const p of payments) {
       const is_payment_method_exist = await getRecord(
         p.payment_method_id,
         "payment_methods",
         "company_id",
         company_id,
         client
       );
       if (!is_payment_method_exist) {
         throw new AppError(`Payment method not found: ${p.payment_method_id}`, 404);
       }
     }
 
     // Calculate aggregated total payment added
     const incomingTotal = payments.reduce((sum, p) => sum + p.payment_amount, 0);
     const paymentObj = payments.map((p) => ({
       payment_amount: p.payment_amount,
       payment_method_id: p.payment_method_id,
       transaction_reference: p.transaction_reference ?? ""
     }));
     const query = `
 UPDATE sales
 SET
   paid = CASE
     WHEN $2 = 'inc' THEN paid - $1
     WHEN $2 = 'exp' THEN paid + $1
     ELSE paid
   END,
   payments = (
     SELECT jsonb_agg(
       jsonb_build_object(
         'payment_amount', summed_data.total_amount,
         'payment_method_id', summed_data.payment_method_id,
         'transaction_reference', summed_data.merged_reference
       )
     )
     FROM (
       SELECT
         (elem->>'payment_method_id')::int AS payment_method_id,
         SUM((elem->>'payment_amount')::numeric) AS total_amount,
         STRING_AGG(NULLIF(elem->>'transaction_reference', ''), ', ') AS merged_reference
       FROM jsonb_array_elements(
         COALESCE(sales.payments, '[]'::jsonb) || $3::jsonb
       ) AS elem
       GROUP BY (elem->>'payment_method_id')::int
     ) summed_data
   ),
   remarks = CASE
     WHEN remarks IS NULL THEN $4::jsonb
     WHEN jsonb_typeof(remarks) = 'array' THEN remarks || $4::jsonb
     ELSE jsonb_build_array(remarks) || $4::jsonb
   END
 WHERE id = $5
   AND firm_id = $6
 RETURNING *;
 `;
 
     const values = [
       incomingTotal,              // $1
       payment_flow,               // $2
       JSON.stringify(paymentObj), // $3
       JSON.stringify(remark),     // $4
       sale_id,                // $5
       firm_id                     // $6
     ];
 
     const { rows } = await executeInTransaction(client, query, values);
     const changes = buildAuditChanges(is_sale_exist, rows[0]);
     return { data: rows[0], changes, table_name: "sales" };
 
   }
}