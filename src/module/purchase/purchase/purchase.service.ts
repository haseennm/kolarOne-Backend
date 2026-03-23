import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { isExist } from "../../../utils/extra";
import { PurchaseCreateParams, PurchaseDeleteParams, PurchaseEditParams, PurchaseFetchParams } from "./purchase.types";

export default class PurchaseService {

  async createPurchase(data: PurchaseCreateParams, client: PoolClient) {
    const {
      bill_date,
      bill_number,
      discount,
      final_amount,
      firm_id,
      net_amount,
      payment_amount,
      payment_method_id,
      remark,
      statusCode,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      vendor_id,
      notes,
      transaction_reference,
      branch_id,
      company_id
    } = data;

    // Check firm existence
    const is_firm_exist = await isExist(
      firm_id,
      "firm",
      "branch_id",
      branch_id,
      client
    );

    if (!is_firm_exist) {
      throw new AppError("Firm not found", 404);
    }
    const is_payment_method_exist = await isExist(
      payment_method_id,
      "payment_methods",
      "company_id",
      company_id,
      client
    );

    if (!is_payment_method_exist) {
      throw new AppError("payment method not found", 404);
    }
    const is_vendor_exist = await isExist(
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
      payment_amount,
      notes,
      status,
      remarks,
      payment_method_id,
      transaction_reference,
      firm_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17
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
      payment_amount ?? 0,
      notes ?? null,
      statusCode,
      JSON.stringify(remark) ?? {},
      payment_method_id ?? null,
      transaction_reference ?? null,
      firm_id
    ];

    const { rows } = await executeInTransaction(client, purchaseQuery, values);
    return rows[0];
  }
  async editPurchase(data: PurchaseEditParams, client: PoolClient) {
    const {
      bill_date,
      bill_number,
      discount,
      final_amount,
      firm_id,
      net_amount,
      payment_amount,
      payment_method_id,
      remark,
      statusCode,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      vendor_id,
      notes,
      transaction_reference,
      branch_id,
      company_id,
      purchase_id
    } = data;

    // Check firm existence
    const is_purchase_exist = await isExist(
      purchase_id,
      "purchases",
      "firm_id",
      firm_id,
      client
    );

    if (!is_purchase_exist) {
      throw new AppError("Firm not found", 404);
    }
    if (payment_method_id && payment_method_id !== is_purchase_exist.payment_method_id) {
      const is_payment_method_exist = await isExist(
        payment_method_id,
        "payment_methods",
        "company_id",
        company_id,
        client
      );

      if (!is_payment_method_exist) {
        throw new AppError("payment method not found", 404);
      }
    }
    if (vendor_id && vendor_id !== is_purchase_exist.vendor_id) {
      const is_vendor_exist = await isExist(
        vendor_id,
        "vendors",
        "company_id",
        company_id,
        client
      );

      if (!is_vendor_exist) {
        throw new AppError("Vendor not found", 404);
      }
    }
    if (bill_number && bill_number !== is_purchase_exist.bill_number) {

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
    }
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
    payment_amount = $11,
    notes = $12,
    status = $13,
    remarks = COALESCE(remarks, '[]'::jsonb) || $14::jsonb,
    payment_method_id = $15,
    transaction_reference = $16 WHERE
    firm_id = $17
   id = $18
  RETURNING *;
`;

    const values = [
      vendor_id,
      bill_number,
      bill_date,
      subtotal ?? is_purchase_exist.sub_total,
      discount ?? is_purchase_exist.discount,
      net_amount ?? is_purchase_exist.net_amount,
      total_cgst ?? is_purchase_exist.total_cgst,
      total_sgst ?? is_purchase_exist.total_sgst,
      total_igst ?? is_purchase_exist.total_igst,
      final_amount ?? is_purchase_exist.final_amount,
      payment_amount ?? is_purchase_exist.payment_amount,
      notes ?? is_purchase_exist.notes,
      statusCode,
      JSON.stringify([remark]),

      payment_method_id ?? is_purchase_exist.payment_method_id,
      transaction_reference ?? is_purchase_exist.transaction_reference,
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
    pm.method_name AS payment_method,
    f.branch_id,
    b.company_id,

    COALESCE(
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
      ) FILTER (WHERE pi.id IS NOT NULL),
      '[]'
    ) AS items

  FROM purchases p
  LEFT JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
  LEFT JOIN firm f ON f.id = p.firm_id
  LEFT JOIN branches b ON b.id = f.branch_id

  LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
  LEFT JOIN products pr ON pr.id = pi.product_id
  LEFT JOIN stock s ON s.id = pi.stock_id

  ${whereClause}

  GROUP BY 
    p.id,
    v.vendor_name,
    pm.method_name,
    f.branch_id,
    b.company_id

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
    const isPurchaseExist = await isExist(
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
  //   const isPurchaseExist = await isExist(
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