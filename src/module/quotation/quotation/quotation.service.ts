import { PoolClient } from "pg";
import { ChangeQuotationStatus, QuotationCreateParams, QuotationDeleteParams, QuotationEditParams, QuotationFetchParams } from "./quotation.types";
import { getRecord, getStatusCode } from "../../../utils/extra";
import { AppError } from "../../../utils/AppError";
import { executeInTransaction, query } from "../../../config/db";
import { buildAuditChanges } from "../../journal/journal.utils";

export default class QuotationService {
  async createQuotation(data: QuotationCreateParams, client: PoolClient) {
    const {
      customer_id,
      invoice_date,
      discount,
      final_amount,
      firm_id,
      net_amount,
      // payments,
      remark,
      subtotal,
      // paid,
      total_cgst,
      total_igst,
      total_sgst,
      notes,
      branch_id,
      company_id,
      price_pool,
      is_intrastate,
      state_code
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
    // if (payments && payments.length > 0) {
    //   for (const p of payments) {
    //     const is_payment_method_exist = await getRecord(
    //       p.payment_method_id,
    //       "payment_methods",
    //       "company_id",
    //       company_id,
    //       client
    //     );

    //     if (!is_payment_method_exist) {
    //       throw new AppError(
    //         `Payment method not found: ${p.payment_method_id}`,
    //         404
    //       );
    //     }
    //   }
    // }

    // ✅ Generate invoice number (LOCK)
    const lastInvoice = await executeInTransaction(
      client,
      `
    SELECT invoice_number
    FROM quotations
    WHERE firm_id = $1
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
    `,
      [firm_id]
    );

    let nextInvoiceNumber: string;

    if (!lastInvoice.rows.length) {
      nextInvoiceNumber = `QUO-${firm_id}-0001`;
    } else {
      const parts = lastInvoice.rows[0].invoice_number.split("-");
      const lastNumber = parts[2] ? parseInt(parts[2], 10) : 0;
      const newNumber = lastNumber + 1;

      nextInvoiceNumber = `QUO-${firm_id}-${String(newNumber).padStart(4, "0")}`;
    }

    const invoice_number = nextInvoiceNumber;

    // const paymentobj = (payments || []).map((p: any) => ({
    //   payment_method_id: p.payment_method_id,
    //   amount: p.amount,
    //   reference: p.reference ?? null
    // }));
    const refResult = await executeInTransaction(
      client,
      `SELECT CONCAT('QU-', LPAD(nextval('quotation_ref_seq')::text, 4, '0')) AS ref;`
    );
    const status = getStatusCode("Confirm")
    const ref_no = refResult.rows[0].ref;
    const query = `
    INSERT INTO quotations (
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
      notes,
      status,
      remarks,
      firm_id,
      ref_no,
      price_pool,
      is_intrastate,
      state_code
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
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
      // JSON.stringify(paymentobj),
      notes ?? null,
      status,
      JSON.stringify(remark ?? {}),
      firm_id,
      // paid,
      ref_no,
      price_pool,
      is_intrastate,
      state_code
    ];

    const { rows } = await executeInTransaction(client, query, values);

    return rows[0];
  }

  async editQuotation(data: QuotationEditParams, client: PoolClient) {
    const {
      quotation_id,
      customer_id,
      invoice_date,
      discount,
      final_amount,
      firm_id,
      net_amount,
      // paid,
      remark,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      notes,
      branch_id,
      company_id,
      // payments
    } = data;

    const is_quotation_exist = await getRecord(
      quotation_id,
      "quotations",
      "firm_id",
      firm_id,
      client
    );
    if (!is_quotation_exist) {
      throw new AppError("Quotations not found", 404);
    }

    // ✅ Validation: Check customer existence (if updating customer)
    if (customer_id && customer_id !== is_quotation_exist.customer_id) {
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
    // if (payments && payments.length > 0) {
    //   for (const p of payments) {
    //     const is_payment_method_exist = await getRecord(
    //       p.payment_method_id,
    //       "payment_methods",
    //       "company_id",
    //       company_id,
    //       client
    //     );
    //     if (!is_payment_method_exist) {
    //       throw new AppError(
    //         `Payment method not found: ${p.payment_method_id}`,
    //         404
    //       );
    //     }
    //   }
    // }

    // ✅ Build payment object if payments provided
    // const paymentobj = payments
    //   ? (payments || []).map((p: any) => ({
    //     payment_method_id: p.payment_method_id,
    //     amount: p.amount,
    //     reference: p.reference ?? null
    //   }))
    //   : (is_quotation_exist.payments || []);
    // const status = this.billStatus((final_amount ?? is_quotation_exist.final_amount), (paid ?? is_quotation_exist.paid))

    const updateQuery = `
      UPDATE quotations SET
        customer_id = $1,
        invoice_date = $2,
        subtotal = $3,
        discount = $4,
        net_amount = $5,
        total_cgst = $6,
        total_sgst = $7,
        total_igst = $8,
        final_amount = $9,
        notes = $10,
        status = $11,
        remarks = COALESCE(remarks, '[]'::jsonb) || $12::jsonb,
      WHERE firm_id = $13 AND id = $14
      RETURNING *;
    `;

    const values = [
      customer_id ?? is_quotation_exist.customer_id,
      invoice_date ?? is_quotation_exist.invoice_date,
      subtotal ?? is_quotation_exist.subtotal,
      discount ?? is_quotation_exist.discount,
      net_amount ?? is_quotation_exist.net_amount,
      total_cgst ?? is_quotation_exist.total_cgst,
      total_sgst ?? is_quotation_exist.total_sgst,
      total_igst ?? is_quotation_exist.total_igst,
      final_amount ?? is_quotation_exist.final_amount,
      // JSON.stringify(paymentobj),
      notes ?? is_quotation_exist.notes,
      status,
      JSON.stringify([remark]),
      // paid ?? is_quotation_exist.paid,
      firm_id,
      quotation_id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    const changes = buildAuditChanges(is_quotation_exist, rows[0]);
    return {data:rows[0],changes};
  }

  async fetchQuotations(data: QuotationFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // status filter
    where.push(`q.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`q.id = $${values.length}`);
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
      where.push(`q.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`q.invoice_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`q.invoice_date <= $${values.length}`);
    }

    // ✅ Updated search (customer_name + invoice_number)
    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      q.invoice_number ILIKE $${values.length}
      OR c.customer_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const quotationQuery = `
    SELECT 
      q.*,
      c.customer_name,
      f.branch_id,
      b.company_id
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN firm f ON f.id = q.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
    ORDER BY q.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN firm f ON f.id = q.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

    const quotations = await query(
      quotationQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      quotations,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async fetchQuotationsFull(data: QuotationFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // status filter
    where.push(`q.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`q.id = $${values.length}`);
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
      where.push(`q.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`q.invoice_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`q.invoice_date <= $${values.length}`);
    }

    // ✅ Updated search
    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      q.invoice_number ILIKE $${values.length}
      OR c.customer_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const quotationsQuery = `
SELECT 
  q.*,
  c.customer_name,
  f.branch_id,
  b.company_id,

  COALESCE(
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', qi.id,
        'product_id', qi.product_id,
        'product_name', pr.name,
        'stock_id', qi.stock_id,
        'batch_number', st.batch_number,
        'quotation_qty', qi.quotation_qty,

        'unit', qi.unit,
        'unit_price', qi.unit_price,
        'sub_total', qi.sub_total,
        'discount', qi.discount,
        'total_cgst', qi.total_cgst,
        'total_sgst', qi.total_sgst,
        'total_igst', qi.total_igst,
        'net_amount', qi.net_amount,
        'final_amount', qi.final_amount,
        'status', qi.status,
        'igst_rate', pr.igst_rate,
        'cgst_rate', pr.cgst_rate,
        'sgst_rate', pr.sgst_rate
      )
    ) FILTER (WHERE qi.id IS NOT NULL),
    '[]'
  ) AS items

FROM quotations q
LEFT JOIN customers c ON c.id = q.customer_id
LEFT JOIN firm f ON f.id = q.firm_id
LEFT JOIN branches b ON b.id = f.branch_id

-- ✅ correct order
LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
LEFT JOIN products pr ON pr.id = qi.product_id
LEFT JOIN stock st ON st.id = qi.stock_id

${whereClause}

-- ✅ ONLY parent grouping
GROUP BY 
  q.id,
  c.customer_name,
  f.branch_id,
  b.company_id

ORDER BY q.id DESC
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
`;

    const countQuery = `
    SELECT COUNT(*)
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN firm f ON f.id = q.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

    const quotations = await query(
      quotationsQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);
    return {
      quotations,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async deleteQuotation(data: QuotationDeleteParams, client: PoolClient) {
    const { id, remark, firm_id } = data;

    const isQuotationsExist = await getRecord(
      id,
      "quotations",
      "firm_id",
      firm_id,
      client
    );

    if (!isQuotationsExist) {
      throw new AppError("Quotation not found or already deleted", 404);
    }

    const queryText = `
    UPDATE quotations s
    SET
      status = $1,
      remarks =
        CASE
          WHEN q.remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(q.remarks) = 'array'
            THEN q.remarks || $2::jsonb
          ELSE jsonb_build_array(q.remarks) || $2::jsonb
        END
    FROM firm f
    JOIN branches b ON f.branch_id = b.id
    WHERE 
      q.id = $3 
      AND q.firm_id = $4
      AND q.firm_id = f.id
    RETURNING q.*, b.company_id;
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
  async changeQuotationStatus(data: ChangeQuotationStatus, client: PoolClient) {
    const { id, remark, status, firm_id } = data;

    const isQuotationsExist = await getRecord(
      id,
      "quotations",
      "firm_id",
      firm_id,
      client
    );

    if (!isQuotationsExist) {
      throw new AppError("Quotation not found", 404);
    }

    const queryText = `
    UPDATE quotations
    SET
      status = $1,
      remarks =
        CASE
          WHEN remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $2::jsonb
          ELSE jsonb_build_array(remarks) || $2::jsonb
        END
    WHERE 
      id = $3 
      AND firm_id = $4
  `;

    const values = [
      status,
      JSON.stringify([remark]), // ensure it's an array
      id,
      firm_id
    ];

    const row = await executeInTransaction(client, queryText, values);

    return row.rows[0];
  }
}