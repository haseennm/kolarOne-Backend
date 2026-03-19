import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { isExist } from "../../../utils/extra";
import { PurchaseCreateParams, PurchaseFetchDb, PurchaseFetchParams } from "./purchase.types";

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
    const isCompanyExist = await isExist(
      firm_id,
      "firm",
      "branch_id",
      branch_id,
      client
    );

    if (!isCompanyExist) {
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
}