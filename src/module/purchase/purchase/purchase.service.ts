import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord, getStatusCode } from "../../../utils/extra";
import { PurchaseCreateParams, PurchaseDeleteParams, PurchaseEditParams, PurchaseFetchParams, RepayBalancePurchase } from "./purchase.types";

export default class PurchaseService {
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

  async createPurchase(data: PurchaseCreateParams, client: PoolClient) {
    const {
      bill_date,
      bill_number,
      discount,
      final_amount,
      firm_id,
      net_amount,
      paid_amount, // Renamed tracking column parameter
      payments,    // Holds the raw stringified payments JSON array
      remark,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      vendor_id,
      notes,
      branch_id,
      company_id,
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

    const is_vendor_exist = await getRecord(
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

    const refResult = await executeInTransaction(
      client,
      `SELECT CONCAT('PB-', nextval('sale_ref_seq')) AS ref`
    );

    const ref_no = refResult.rows[0].ref;

    // The database schema columns updated to reflect your new design requirements
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
      paid_amount,
      notes,
      status,
      remarks,
      payments,
      firm_id,
      ref_no,
      courier_charge,
      handling_charge,
      other_charge
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
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
      paid_amount ?? 0,
      notes ?? null,
      this.billStatus(final_amount ?? 0, paid_amount ?? 0),
      JSON.stringify(remark) ?? {},
      payments, // Inserted as a text / jsonb type value directly mapping your payload structure
      firm_id,
      ref_no,
      courier_charge,
      handling_charge,
      other_charge
    ];

    const { rows } = await executeInTransaction(client, purchaseQuery, values);
    return rows[0];
  }
  //   async editPurchase(data: PurchaseEditParams, client: PoolClient) {
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
  //       subtotal,
  //       total_cgst,
  //       total_igst,
  //       total_sgst,
  //       vendor_id,
  //       notes,
  //       transaction_reference,
  //       branch_id,
  //       company_id,
  //       purchase_id,
  //       courier_charge,
  //       handling_charge,
  //       other_charge,

  //     } = data;

  //     const is_purchase_exist = await getRecord(
  //       purchase_id,
  //       "purchases",
  //       "firm_id",
  //       firm_id,
  //       client
  //     );

  //     if (!is_purchase_exist) {
  //       throw new AppError("Purchase not found", 404);
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
  //      remarks = CASE
  //         WHEN remarks IS NULL THEN $14::jsonb
  //         WHEN jsonb_typeof(remarks) = 'array'
  //           THEN remarks || $14::jsonb
  //         ELSE jsonb_build_array(remarks) || $14::jsonb
  //       END,
  //     payment_method_id = $15,
  //     transaction_reference = $16
  //     courier_charge =$17,
  //       handling_charge =$18,
  //       other_charge =$19 
  //       WHERE
  //     firm_id = $20 AND
  //    id = $21
  //   RETURNING *;
  // `;

  //     const values = [
  //       vendor_id ?? is_purchase_exist.vendor_id,
  //       bill_number ?? is_purchase_exist.bill_number,
  //       bill_date ?? is_purchase_exist.bill_date,
  //       subtotal ?? is_purchase_exist.subtotal,
  //       discount ?? is_purchase_exist.discount,
  //       net_amount ?? is_purchase_exist.net_amount,
  //       total_cgst ?? is_purchase_exist.total_cgst,
  //       total_sgst ?? is_purchase_exist.total_sgst,
  //       total_igst ?? is_purchase_exist.total_igst,
  //       final_amount ?? is_purchase_exist.final_amount,
  //       payment_amount ?? is_purchase_exist.payment_amount,
  //       notes ?? is_purchase_exist.notes,
  //       this.billStatus(
  //         final_amount ?? is_purchase_exist.final_amount,
  //         payment_amount ?? is_purchase_exist.payment_amount
  //       ),
  //       JSON.stringify([remark]),
  //       payment_method_id ?? is_purchase_exist.payment_method_id,
  //       transaction_reference ?? is_purchase_exist.transaction_reference,
  //       courier_charge ?? is_purchase_exist.courier_charge,
  //       handling_charge ?? is_purchase_exist.handling_charge,
  //       other_charge ?? is_purchase_exist.transaction_reference,
  //       firm_id,
  //       purchase_id
  //     ];
  //     const { rows } = await executeInTransaction(client, purchaseQuery, values);
  //     return rows[0];
  //   }
  async editPurchase(data: PurchaseEditParams, client: PoolClient) {
    const {
      bill_date,
      bill_number,
      discount,
      final_amount,
      firm_id,
      net_amount,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      vendor_id,
      notes,
      branch_id,
      company_id,
      purchase_id,
      courier_charge,
      handling_charge,
      other_charge,
      remark,
      computed_payment_amount,
      merged_payments_json
    } = data;

    // 1. Safe Lock Read Boundary Check
    const queryExisting = await executeInTransaction(
      client,
      `SELECT * FROM purchases WHERE id = $1 AND firm_id = $2 FOR UPDATE;`,
      [purchase_id, firm_id]
    );

    const is_purchase_exist = queryExisting.rows[0];
    if (!is_purchase_exist) {
      throw new AppError("Purchase not found", 404);
    }

    // 2. Validate Vendor Entity Link
    if (vendor_id && vendor_id !== is_purchase_exist.vendor_id) {
      const is_vendor_exist = await getRecord(vendor_id, "vendors", "company_id", company_id, client);
      if (!is_vendor_exist) {
        throw new AppError("Vendor not found", 404);
      }
    }

    // 3. Unique Sequence Constraint Verifications
    if (bill_number && bill_number !== is_purchase_exist.bill_number) {
      const activeVendor = vendor_id ?? is_purchase_exist.vendor_id;
      const is_bill_exist = await executeInTransaction(
        client,
        `SELECT id FROM purchases WHERE bill_number = $1 AND vendor_id = $2 AND status != 'Cancelled' AND id != $3`,
        [bill_number, activeVendor, purchase_id]
      );
      if ((is_bill_exist.rowCount ?? 0) > 0) {
        throw new AppError("purchase bill already exist", 400);
      }
    }

    // 4. Update Core purchases Record
 // Inside purchase.services.ts
// Ensure returning row mapping attributes target paid_amount = $11 correctly
const purchaseQuery = `
  UPDATE purchases SET
    vendor_id = $1,
    bill_number = $2,
    bill_date = $3,
    subtotal = $4,
    discount = $5,
    net_amount = $6,
    total_cgst = $7,
    total_sgst = $8,
    total_igst = $9,
    final_amount = $10,
    paid_amount = $11, -- ✅ Check this name aligns precisely with schema definition definitions
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
    other_charge = $18 
  WHERE firm_id = $19 AND id = $20
  RETURNING *;
`;
    const targetFinalAmount = final_amount ?? is_purchase_exist.final_amount;

    const values = [
      vendor_id ?? is_purchase_exist.vendor_id,
      bill_number ?? is_purchase_exist.bill_number,
      bill_date ?? is_purchase_exist.bill_date,
      subtotal ?? is_purchase_exist.subtotal,
      discount ?? is_purchase_exist.discount,
      net_amount ?? is_purchase_exist.net_amount,
      total_cgst ?? is_purchase_exist.total_cgst,
      total_sgst ?? is_purchase_exist.total_sgst,
      total_igst ?? is_purchase_exist.total_igst,
      targetFinalAmount,
      computed_payment_amount,
      notes ?? is_purchase_exist.notes,
      this.billStatus(Number(targetFinalAmount), computed_payment_amount),
      JSON.stringify([remark]),
      merged_payments_json,
      courier_charge ?? is_purchase_exist.courier_charge,
      handling_charge ?? is_purchase_exist.handling_charge,
      other_charge ?? is_purchase_exist.other_charge,
      firm_id,
      purchase_id
    ];

    const { rows } = await executeInTransaction(client, purchaseQuery, values);
    return rows[0];
  }
  async fetchPurchase(data: PurchaseFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`p.status != $${values.length + 1}`);
    values.push(0);
    if (filters?.id) {
      values.push(filters.id);
      where.push(`p.id = $${values.length}`);
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
      where.push(`p.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`p.bill_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`p.bill_date <= $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      p.bill_number ILIKE $${values.length}
      OR v.vendor_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseQuery = `
  SELECT 
    p.*,
    v.vendor_name,
    f.branch_id,
    b.company_id
  FROM purchases p
  LEFT JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN firm f ON f.id = p.firm_id
  LEFT JOIN branches b ON b.id = f.branch_id
  ${whereClause}
  ORDER BY p.id DESC
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
  SELECT COUNT(*)
  FROM purchases p
  LEFT JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN firm f ON f.id = p.firm_id
  LEFT JOIN branches b ON b.id = f.branch_id
  ${whereClause}
`;

    const purchases = await query(
      purchaseQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      purchases,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async fetchPurchaseFull(data: PurchaseFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`p.status != $${values.length + 1}`);
    values.push(0);
    if (filters?.id) {
      values.push(filters.id);
      where.push(`p.id = $${values.length}`);
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
      where.push(`p.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`p.bill_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`p.bill_date <= $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      p.bill_number ILIKE $${values.length}
      OR v.vendor_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseQuery = `
SELECT
    p.*,
    v.vendor_name,
    f.branch_id,
    b.company_id,

    (
        SELECT COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', pi.id,
                    'product_id', pi.product_id,
                    'product_name', pr.name,
                    'stock_id', pi.stock_id,
                    'batch_number', s.batch_number,
                    'received_qty', pi.received_qty,
                    'purchased_qty', pi.purchased_qty,
                    'unit', pi.unit,
                    'unit_price', pi.unit_price,
                    'sub_total', pi.sub_total,
                    'total_cgst', pi.total_cgst,
                    'total_sgst', pi.total_sgst,
                    'total_igst', pi.total_igst,
                    'net_amount', pi.net_amount,
                    'status', pi.status
                )
                ORDER BY pi.id
            ),
            '[]'
        )
        FROM purchase_items pi
        LEFT JOIN products pr ON pr.id = pi.product_id
        LEFT JOIN stock s ON s.id = pi.stock_id
        WHERE pi.purchase_id = p.id
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
        WHERE pt.ref_id = p.id
          AND pt.ref_type = 'PS'
    ) AS payments

FROM purchases p
LEFT JOIN vendors v
    ON v.id = p.vendor_id
LEFT JOIN firm f
    ON f.id = p.firm_id
LEFT JOIN branches b
    ON b.id = f.branch_id

${whereClause}

ORDER BY p.id DESC
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
`;

    const countQuery = `
  SELECT COUNT(*)
  FROM purchases p
  LEFT JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN firm f ON f.id = p.firm_id
  LEFT JOIN branches b ON b.id = f.branch_id
  ${whereClause}
`;

    const purchases = await query(
      purchaseQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      purchases,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async deletePurchase(data: PurchaseDeleteParams, client: PoolClient) {
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

    await this.canDeletePurchase(data, client);

    const queryText = `
    UPDATE purchases p
    SET
      status = $1,
      remarks =
        CASE
          WHEN p.remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(p.remarks) = 'array'
            THEN p.remarks || $2::jsonb
          ELSE jsonb_build_array(p.remarks) || $2::jsonb
        END
    FROM firm f
    JOIN branches b ON f.branch_id = b.id
    WHERE 
      p.id = $3 
      AND p.firm_id = $4
      AND p.firm_id = f.id
    RETURNING p.*, b.company_id;
  `;

    const values = [
      0,
      JSON.stringify([remark]),
      id,
      firm_id
    ];

    const row = await executeInTransaction(client, queryText, values);

    return row.rows[0];
  }
  async canDeletePurchase(data: PurchaseDeleteParams, client: PoolClient) {
    const { id, firm_id } = data;

    const purchaseReturn = await executeInTransaction(
      client,
      `SELECT 1 
     FROM purchase_return 
     WHERE purchase_id = $1 
       AND status = $2 
       AND firm_id = $3`,
      [id, 0, firm_id]
    );

    if (purchaseReturn.rows.length > 0) {
      throw new AppError(
        "Purchase return already exists, cannot delete",
        400
      );
    }

    const stockUsedInSales = await executeInTransaction(
      client,
      `
    SELECT 1
    FROM stock s
    JOIN sales_items si ON si.stock_id = s.id
    WHERE s.purchase_id = $1
      AND s.firm_id = $2
    LIMIT 1
    `,
      [id, firm_id]
    );

    if (stockUsedInSales.rows.length > 0) {
      throw new AppError(
        "Stock from this purchase is already used in sales, cannot delete",
        400
      );
    }

    return true;
  }
  async updatePurchasePaymentAmount(
    data: RepayBalancePurchase,
    client: PoolClient
  ) {
    const { firm_id, payments, purchase_id, remark, company_id, payment_flow } = data;
    // 1. Fetch record first to check existence
    const is_purchase_exist = await getRecord(
      purchase_id,
      "purchases",
      "firm_id",
      firm_id,
      client
    );

    if (!is_purchase_exist) {
      throw new AppError("Purchase not found", 404);
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
UPDATE purchases
SET
  paid_amount = CASE
    WHEN $2 = 'inc' THEN paid_amount - $1
    WHEN $2 = 'exp' THEN paid_amount + $1
    ELSE paid_amount
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
        COALESCE(purchases.payments, '[]'::jsonb) || $3::jsonb
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
      purchase_id,                // $5
      firm_id                     // $6
    ];

    const { rows } = await executeInTransaction(client, query, values);
    return rows[0];
  }



}
