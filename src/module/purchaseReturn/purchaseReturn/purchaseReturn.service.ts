import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord, getStatusCode } from "../../../utils/extra";
import { PurchaseReturnCreateParams, PurchaseReturnDeleteParams, PurchaseReturnFetchParams, PurchaseReturnReturnParams, RepayBalancePurchaseReturn } from "./purchaseReturn.types";

export default class PurchaseReturnService {

  //   async createPurchaseReturn(data: PurchaseReturnCreateParams, client: PoolClient) {
  //     const {
  //       final_amount,
  //       firm_id,
  //       payment_amount,
  //       payment_method_id,
  //       remark,
  //       statusCode,
  //       subtotal,
  //       total_cgst,
  //       total_igst,
  //       total_sgst,
  //       transaction_reference,
  //       branch_id,
  //       company_id,
  //       purchase_id,
  //       return_date,
  //       reason
  //     } = data;

  //     const is_firm_exist = await getRecord(
  //       firm_id,
  //       "firm",
  //       "branch_id",
  //       branch_id,
  //       client
  //     );

  //     if (!is_firm_exist) {
  //       throw new AppError("Firm not found", 404);
  //     }
  //     const is_Purchase_exist = await getRecord(
  //       purchase_id,
  //       "purchases",
  //       "firm_id",
  //       firm_id,
  //       client
  //     );

  //     if (!is_Purchase_exist) {
  //       throw new AppError("Purchase not found", 404);
  //     }
  //     const is_payment_method_exist = await getRecord(
  //       payment_method_id,
  //       "payment_methods",
  //       "company_id",
  //       company_id,
  //       client
  //     );

  //     if (!is_payment_method_exist) {
  //       throw new AppError("payment method not found", 404);
  //     }

  //     const result = await executeInTransaction(
  //       client,
  //       `
  //   SELECT return_number
  //   FROM purchase_return
  //   WHERE firm_id = $1
  //   ORDER BY id DESC
  //   LIMIT 1
  //   FOR UPDATE
  //   `,
  //       [firm_id]
  //     );

  //     let return_number;

  //     if (!result.rows.length) {
  //       return_number = `PRRTN-${firm_id}-0001`;
  //     } else {
  //       const lastReturn = result.rows[0];

  //       const lastNumber = parseInt(
  //         lastReturn.return_number.split("-")[2],
  //         10
  //       );

  //       const newNumber = lastNumber + 1;

  //       return_number = `PRRTN-${firm_id}-${String(newNumber).padStart(4, "0")}`;
  //     }
  //     const query = `
  //   INSERT INTO purchase_return
  //   (
  //     purchase_id,
  //     return_number,
  //     return_date,
  //     reason,
  //     sub_total,
  //     total_cgst,
  //     total_sgst,
  //     total_igst,
  //     status,
  //     remarks,
  //     firm_id,
  //     --net_amount,
  //     final_amount,
  //     payment_method_id,
  //     reference_number,
  //     paid_amount
  //   )
  //   VALUES (
  //     $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
  //   )
  //   RETURNING *;
  // `;

  //     const values = [
  //       purchase_id,
  //       return_number,
  //       return_date,
  //       reason || null,
  //       subtotal ?? 0,
  //       total_cgst ?? 0,
  //       total_sgst ?? 0,
  //       total_igst ?? 0,
  //       statusCode,
  //       JSON.stringify(remark),
  //       firm_id,
  //       final_amount ?? 0,
  //       payment_method_id ?? null,
  //       transaction_reference ?? null,
  //       payment_amount
  //     ];

  //     const { rows } = await executeInTransaction(client, query, values);
  //     return rows[0];
  //   }
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
  async createPurchaseReturn(data: PurchaseReturnCreateParams, client: PoolClient) {
    const {
      final_amount,
      firm_id,
      payment_amount,
      remark,
      statusCode,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      branch_id,
      company_id,
      purchase_id,
      return_date,
      reason,
      payments // Array mapping payload container reference object
    } = data;

    // Validate Firm existences
    const is_firm_exist = await getRecord(firm_id, "firm", "branch_id", branch_id, client);
    if (!is_firm_exist) {
      throw new AppError("Firm not found", 404);
    }

    // Validate parent Purchase order presence
    const is_Purchase_exist = await getRecord(purchase_id, "purchases", "firm_id", firm_id, client);
    if (!is_Purchase_exist) {
      throw new AppError("Purchase matching reference target not found", 404);
    }

    // Verify elements within custom array values block configuration
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
            throw new AppError(`Payment method context matching: ${p.payment_method_id} not found`, 404);
          }
        }
      }
    }

    // Lock row sequences index values
    const result = await executeInTransaction(
      client,
      `
    SELECT return_number
    FROM purchase_return
    WHERE firm_id = $1
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
    `,
      [firm_id]
    );

    let return_number: string;

    if (!result.rows.length) {
      return_number = `PRRTN-${firm_id}-0001`;
    } else {
      const lastReturn = result.rows[0];
      const parts = lastReturn.return_number.split("-");
      const lastNumber = parseInt(parts[2] || "0", 10);
      const newNumber = lastNumber + 1;

      return_number = `PRRTN-${firm_id}-${String(newNumber).padStart(4, "0")}`;
    }

    // Single entity columns replaced with a singular structured 'payments' JSON payload row block mapping
    const query = `
    INSERT INTO purchase_return (
      purchase_id,
      return_number,
      return_date,
      reason,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      status,
      remarks,
      firm_id,
      final_amount,
      refund_amount,
      payments
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    RETURNING *;
  `;

    const values = [
      purchase_id,
      return_number,
      return_date,
      reason || null,
      subtotal ?? 0,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      this.billStatus(final_amount ?? 0, payment_amount ?? 0),
      JSON.stringify(remark ?? {}),
      firm_id,
      final_amount ?? 0,
      payment_amount ?? 0,
      typeof payments === "string" ? payments : JSON.stringify(payments)
    ];

    const { rows } = await executeInTransaction(client, query, values);
    return rows[0];
  }
  //   async editPurchaseReturn(data: PurchaseReturnEditParams, client: PoolClient) {
  //     const {
  //       return_date,
  //       reason,
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
  //       transaction_reference,
  //       branch_id,
  //       company_id,
  //       purchase_return_id,
  //     } = data;

  //     const is_purchase_return_exist = await getRecord(
  //       purchase_return_id,
  //       "purchase_return",
  //       "firm_id",
  //       firm_id,
  //       client
  //     );

  //     if (!is_purchase_return_exist) {
  //       throw new AppError("Firm not found", 404);
  //     }
  //     if (payment_method_id && payment_method_id !== is_purchase_return_exist.payment_method_id) {
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

  //     const purchaseQuery = `
  //     UPDATE purchase_return SET
  //     return_date = $1,
  //     reason = $2,
  //     sub_total = $3,
  //     total_cgst = $4,
  //     total_sgst = $5,
  //     total_igst = $6,
  //     final_amount = $7,
  //     payment_method_id = $8,
  //     reference_number = $9,
  //     status = $10,
  //     remarks = COALESCE(remarks, '[]'::jsonb) || COALESCE($11::jsonb, '[]'::jsonb)
  // WHERE
  //     firm_id = $12
  //     AND id = $13
  // RETURNING *;
  // `;
  //     const values = [
  //       return_date ?? is_purchase_return_exist.return_date,   // $1
  //       reason ?? is_purchase_return_exist.reason,             // $2
  //       subtotal ?? is_purchase_return_exist.sub_total,        // $3
  //       total_cgst ?? is_purchase_return_exist.total_cgst,     // $5
  //       total_sgst ?? is_purchase_return_exist.total_sgst,     // $6
  //       total_igst ?? is_purchase_return_exist.total_igst,     // $7
  //       final_amount ?? is_purchase_return_exist.final_amount, // $8
  //       payment_method_id ?? is_purchase_return_exist.payment_method_id, // $10
  //       transaction_reference ?? is_purchase_return_exist.reference_number, // $11
  //       statusCode,                                            // $12
  //       JSON.stringify([remark]),                              // $13
  //       firm_id,                                               // $14
  //       purchase_return_id                                     // $15
  //     ];

  //     const { rows } = await executeInTransaction(client, purchaseQuery, values);
  //     return rows[0];
  //   }
  async editPurchaseReturn(data: PurchaseReturnReturnParams, client: PoolClient) {
    const {
      return_date,
      return_number,
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
      reason,
      branch_id,
      company_id,
      purchase_return_id,
      courier_charge,
      handling_charge,
      other_charge,
      remark,
      computed_payment_amount,
      merged_payments_json
    } = data;

    // 1. Isolation level row lock fetch
    const queryExisting = await executeInTransaction(
      client,
      `SELECT * FROM purchase_return WHERE id = $1 AND firm_id = $2 FOR UPDATE;`,
      [purchase_return_id, firm_id]
    );

    const is_return_exist = queryExisting.rows[0];
    if (!is_return_exist) {
      throw new AppError("Purchase return document reference not found", 404);
    }

    // 2. Unique Constraints Validation
    if (return_number && return_number !== is_return_exist.return_number) {
      const activeVendor = vendor_id ?? is_return_exist.vendor_id;
      const is_bill_exist = await executeInTransaction(
        client,
        `SELECT id FROM purchase_return WHERE return_number = $1 AND vendor_id = $2 AND status != 'Cancelled' AND id != $3`,
        [return_number, activeVendor, purchase_return_id]
      );
      if ((is_bill_exist.rowCount ?? 0) > 0) {
        throw new AppError("Purchase return document number sequence already exists", 400);
      }
    }

    // 3. Mutate persistent store state
    const prQuery = `
    UPDATE purchase_return SET
    reason = $1,
    return_number = $2,
    return_date = $3,
    sub_total = $4,
    total_cgst = $5,
    total_sgst = $6,
    total_igst = $7,
    final_amount = $8,
    refund_amount = $9,
    status = $10,
    remarks = CASE
      WHEN remarks IS NULL THEN $11::jsonb
      WHEN jsonb_typeof(remarks) = 'array' THEN remarks || $11::jsonb
      ELSE jsonb_build_array(remarks) || $11::jsonb
    END,
    payments = $12
WHERE firm_id = $13
  AND id = $14
RETURNING *;
    `;

    const targetFinalAmount = final_amount ?? is_return_exist.final_amount;

    const values = [
      reason ?? is_return_exist.reason,
      return_number ?? is_return_exist.return_number,
      return_date ?? is_return_exist.return_date,
      subtotal ?? is_return_exist.subtotal,
      total_cgst ?? is_return_exist.total_cgst,
      total_sgst ?? is_return_exist.total_sgst,
      total_igst ?? is_return_exist.total_igst,
      targetFinalAmount,
      computed_payment_amount,
      this.billStatus(targetFinalAmount,computed_payment_amount),
      JSON.stringify([remark]),
      merged_payments_json,
      firm_id,
      purchase_return_id
    ];

    const { rows } = await executeInTransaction(client, prQuery, values);
    return rows[0];
  }


  async fetchReturnPurchase(data: PurchaseReturnFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`pr.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`pr.id = $${values.length}`);
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
      where.push(`pr.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`pr.return_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`pr.return_date <= $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      pr.return_number ILIKE $${values.length}
      OR pu.bill_number ILIKE $${values.length}
      OR v.vendor_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseReturnQuery = `
    SELECT 
      pr.*,
      pu.bill_number,
      v.vendor_name,
      f.branch_id,
      b.company_id
    FROM purchase_return pr
    LEFT JOIN purchases pu ON pu.id = pr.purchase_id
    LEFT JOIN vendors v ON v.id = pu.vendor_id
    LEFT JOIN firm f ON f.id = pr.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
    ORDER BY pr.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM purchase_return pr
    LEFT JOIN purchases pu ON pu.id = pr.purchase_id
    LEFT JOIN vendors v ON v.id = pu.vendor_id
    LEFT JOIN firm f ON f.id = pr.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

    const purchaseReturns = await query(
      purchaseReturnQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      purchaseReturns,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async fetchPurchaseReturnFull(data: PurchaseReturnFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`pr.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`pr.id = $${values.length}`);
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
      where.push(`pr.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`pr.return_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`pr.return_date <= $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      pr.return_number ILIKE $${values.length}
      OR pu.bill_number ILIKE $${values.length}
      OR v.vendor_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseReturnQuery = `
      SELECT
          pr.*,
          pu.bill_number,
          v.vendor_name,
          f.branch_id,
          b.company_id,

          COALESCE(
              JSON_AGG(
                  JSON_BUILD_OBJECT(
                      'id', pri.id,
                      'product_id', pri.product_id,
                      'product_name', prd.name,
                      'stock_id', pri.stock_id,
                      'batch_number', s.batch_number,
                      'returned_qty', pri.returned_qty,
                      'unit', pri.unit,
                      'unit_price', pri.unit_price,
                      'sub_total', pri.sub_total,
                      'total_cgst', pri.total_cgst,
                      'total_sgst', pri.total_sgst,
                      'total_igst', pri.total_igst,
                      'final_amount', pri.net_amount,
                      'max_return_qty', pi.purchased_qty,
                      'purchase_item_id', pi.purchase_item_id,
                      'status', pri.status
                  )
              ) FILTER (WHERE pri.id IS NOT NULL),
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
              WHERE pt.ref_id = pr.id
                AND pt.ref_type = 'PR'
          ) AS payments

      FROM purchase_return pr

      LEFT JOIN purchases pu
          ON pu.id = pr.purchase_id

      LEFT JOIN vendors v
          ON v.id = pu.vendor_id

      LEFT JOIN firm f
          ON f.id = pr.firm_id

      LEFT JOIN branches b
          ON b.id = f.branch_id

      LEFT JOIN purchase_return_items pri
          ON pri.purchase_return_id = pr.id

      LEFT JOIN purchase_items pi
          ON pi.id = pri.purchase_item_id

      LEFT JOIN products prd
          ON prd.id = pri.product_id

      LEFT JOIN stock s
          ON s.id = pri.stock_id

      ${whereClause}

      GROUP BY
          pr.id,
          pu.bill_number,
          v.vendor_name,
          f.branch_id,
          b.company_id

      ORDER BY pr.id DESC

      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `;

    // 🔥 COUNT QUERY
    const countQuery = `
    SELECT COUNT(*)
    FROM purchase_return pr
    LEFT JOIN purchases pu ON pu.id = pr.purchase_id
    LEFT JOIN vendors v ON v.id = pu.vendor_id
    LEFT JOIN firm f ON f.id = pr.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

    const purchaseReturns = await query(
      purchaseReturnQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      purchaseReturns,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async deletePurchaseReturn(
    data: PurchaseReturnDeleteParams,
    client: PoolClient
  ) {
    const { id, remark, firm_id } = data;

    // ✅ Check existence
    const getRecordPR = await getRecord(
      id,
      "purchase_return",
      "firm_id",
      firm_id,
      client
    );

    if (!getRecordPR) {
      throw new AppError("Purchase return not found or already deleted", 404);
    }

    const queryText = `
    UPDATE purchase_return pr
    SET
      status = $1,
      remarks =
        CASE
          WHEN jsonb_typeof(pr.remarks) = 'array'
            THEN pr.remarks || $2::jsonb
          ELSE jsonb_build_array(pr.remarks) || $2::jsonb
        END
    FROM firm f
    JOIN branches b ON f.branch_id = b.id
    WHERE 
      pr.id = $3 
      AND pr.firm_id = $4
      AND pr.firm_id = f.id
    RETURNING pr.id, b.company_id;
  `;

    const values = [
      0, // deleted status
      JSON.stringify(remark),
      id,
      firm_id
    ];

    const result = await executeInTransaction(client, queryText, values);

    return result.rows[0];
  }
  async updatePurchaseReturnPaymentAmount(
    data: RepayBalancePurchaseReturn,
    client: PoolClient
  ) {
    const { firm_id, payments, purchase_return_id, remark, company_id } = data;

    const is_purchase_return_exist = await getRecord(
      purchase_return_id,
      "purchase_return",
      "firm_id",
      firm_id,
      client
    );

    if (!is_purchase_return_exist) {
      throw new AppError("Purchase return not found", 404);
    }

    // Validate payment methods
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

    const incomingTotal = payments.reduce((sum, p) => sum + p.payment_amount, 0);
    const paymentObj = payments.map((p) => ({
      payment_amount: p.payment_amount,
      payment_method_id: p.payment_method_id,
      transaction_reference: p.transaction_reference ?? ""
    }));

    const query = `
      UPDATE purchase_return
      SET 
        paid_amount = paid_amount + $1,
        payments = (
          SELECT jsonb_agg(jsonb_build_object(
            'payment_amount', summed_data.total_amount,
            'payment_method_id', summed_data.payment_method_id,
            'transaction_reference', summed_data.merged_reference
          ))
          FROM (
            SELECT 
              (elem->>'payment_method_id')::int as payment_method_id,
              SUM((elem->>'payment_amount')::numeric) as total_amount,
              STRING_AGG(NULLIF(elem->>'transaction_reference', ''), ', ') as merged_reference
            FROM jsonb_array_elements(COALESCE(purchase_return.payments, '[]'::jsonb) || $2::jsonb) AS elem
            GROUP BY (elem->>'payment_method_id')::int
          ) summed_data
        ),
        remarks = CASE
          WHEN remarks IS NULL THEN $3::jsonb
          WHEN jsonb_typeof(remarks) = 'array' THEN remarks || $3::jsonb
          ELSE jsonb_build_array(remarks) || $3::jsonb
        END
      WHERE id = $4 AND firm_id = $5
      RETURNING *;
    `;

    const values = [
      incomingTotal,
      JSON.stringify(paymentObj),
      JSON.stringify(remark),
      purchase_return_id,
      firm_id
    ];

    const { rows } = await executeInTransaction(client, query, values);
    return rows[0];
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