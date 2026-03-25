import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord } from "../../../utils/extra";
import { SaleCreateParams, SaleDeleteParams, SaleEditParams, SaleFetchParams } from "./sale.types";

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
  //   async editSale(data: SaleEditParams, client: PoolClient) {
  //     const {
  //       bill_date,
  //       bill_number,
  //       discount,
  //       final_amount,
  //       firm_id,
  //       net_amount,
  //       payment_amount,
  //       payment_method_id,
  //       remark,
  //       statusCode,
  //       subtotal,
  //       total_cgst,
  //       total_igst,
  //       total_sgst,
  //       vendor_id,
  //       notes,
  //       transaction_reference,
  //       branch_id,
  //       company_id,
  //       purchase_id
  //     } = data;

  //     // Check firm existence
  //     const is_purchase_exist = await getRecord(
  //       purchase_id,
  //       "purchases",
  //       "firm_id",
  //       firm_id,
  //       client
  //     );

  //     if (!is_purchase_exist) {
  //       throw new AppError("Firm not found", 404);
  //     }
  //     if (payment_method_id && payment_method_id !== is_purchase_exist.payment_method_id) {
  //       const is_payment_method_exist = await getRecord(
  //         payment_method_id,
  //         "payment_methods",
  //         "company_id",
  //         company_id,
  //         client
  //       );

  //       if (!is_payment_method_exist) {
  //         throw new AppError("payment method not found", 404);
  //       }
  //     }
  //     if (vendor_id && vendor_id !== is_purchase_exist.vendor_id) {
  //       const is_vendor_exist = await getRecord(
  //         vendor_id,
  //         "vendors",
  //         "company_id",
  //         company_id,
  //         client
  //       );

  //       if (!is_vendor_exist) {
  //         throw new AppError("Vendor not found", 404);
  //       }
  //     }
  //     if (bill_number && bill_number !== is_purchase_exist.bill_number) {

  //       const is_bill_exist = await executeInTransaction(
  //         client,
  //         `SELECT id FROM purchases 
  //    WHERE bill_number = $1 
  //    AND vendor_id = $2 
  //    AND status != 0`,
  //         [bill_number, vendor_id]
  //       );

  //       if ((is_bill_exist.rowCount ?? 0) > 0) {
  //         throw new AppError("purchase bill already exist", 400);
  //       }
  //     }
  //     const purchaseQuery = `
  //   UPDATE purchases SET
  //     vendor_id = $1,
  //     bill_number = $2,
  //     bill_date = $3,
  //     subtotal = $4,
  //     discount = $5,
  //     net_amount = $6,
  //     total_cgst = $7,
  //     total_sgst = $8,
  //     total_igst = $9,
  //     final_amount = $10,
  //     payment_amount = $11,
  //     notes = $12,
  //     status = $13,
  //     remarks = COALESCE(remarks, '[]'::jsonb) || $14::jsonb,
  //     payment_method_id = $15,
  //     transaction_reference = $16 WHERE
  //     firm_id = $17
  //    id = $18
  //   RETURNING *;
  // `;

  //     const values = [
  //       vendor_id,
  //       bill_number,
  //       bill_date,
  //       subtotal ?? is_purchase_exist.sub_total,
  //       discount ?? is_purchase_exist.discount,
  //       net_amount ?? is_purchase_exist.net_amount,
  //       total_cgst ?? is_purchase_exist.total_cgst,
  //       total_sgst ?? is_purchase_exist.total_sgst,
  //       total_igst ?? is_purchase_exist.total_igst,
  //       final_amount ?? is_purchase_exist.final_amount,
  //       payment_amount ?? is_purchase_exist.payment_amount,
  //       notes ?? is_purchase_exist.notes,
  //       statusCode,
  //       JSON.stringify([remark]),

  //       payment_method_id ?? is_purchase_exist.payment_method_id,
  //       transaction_reference ?? is_purchase_exist.transaction_reference,
  //       firm_id,
  //       purchase_id
  //     ];

  //     const { rows } = await executeInTransaction(client, purchaseQuery, values);
  //     return rows[0];
  //   }

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

      -- ✅ Sale Items
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', si.id,
            'product_id', si.product_id,
            'product_name', pr.name,
            'stock_id', si.stock_id,
            'batch_number', st.batch_number,
            'saled_qty', si.saled_qty,
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

    LEFT JOIN sales_items si ON si.sale_id = s.id
    LEFT JOIN products pr ON pr.id = si.product_id
    LEFT JOIN stock st ON st.id = si.stock_id

    ${whereClause}

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
    const isPurchaseExist = await getRecord(
      id,
      "purchases",
      "firm_id",
      firm_id,
      client
    );

    if (!isPurchaseExist) {
      throw new AppError("Purchase not found or already deleted", 404);
    }

    // this.canDeletePurchase(data, client)
    // if (!this.canDeletePurchase) {
    //   throw new AppError("Can't delete purchase now ", 500)
    // }
    const queryText = `
  UPDATE purchases p
  SET
    status = $1,
    remarks =
      CASE
        WHEN jsonb_typeof(p.remarks) = 'array'
          THEN p.remarks || $2::jsonb
        ELSE jsonb_build_array(p.remarks) || $2::jsonb
      END
  FROM firms f
  JOIN branches b ON f.branch_id = b.id
  WHERE 
    p.id = $3 
    AND p.firm_id = $4
    AND p.firm_id = f.id
  RETURNING p.*, b.company_id;
`;

    const values = [
      0,
      JSON.stringify(remark),
      id, firm_id
    ];

    const row = await executeInTransaction(client, queryText, values);

    return row.rows[0];
  }
  // async canDeletePurchase(data: PurchaseDeleteParams, client: PoolClient) {
  //   const { id, firm_id } = data;
  //   const isPurchaseExist = await getRecord(
  //     id,
  //     "purchases",
  //     "firm_id",
  //     firm_id,
  //     client
  //   );

  //   if (!isPurchaseExist) {
  //     throw new AppError("Purchase not found or already deleted", 404);
  //   }



  //   const queryText = `
  //       UPDATE purchases
  //       SET
  //         status = $1,
  //         remarks =
  //           CASE
  //             WHEN jsonb_typeof(remarks) = 'array'
  //               THEN remarks || $2::jsonb
  //             ELSE jsonb_build_array(remarks) || $2::jsonb
  //           END
  //       WHERE id = $3 AND firm_id =$4
  //       RETURNING *;
  //       `;

  //   const values = [
  //     0,
  //     JSON.stringify(remark),
  //     id, firm_id
  //   ];

  //   const row = await executeInTransaction(client, queryText, values);

  //   return row.rows[0];
  // }
}