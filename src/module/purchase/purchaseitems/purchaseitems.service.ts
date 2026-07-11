import { getRecord, getStatusCode } from "../../../utils/extra";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { CreatePurchaseItemParams, DeletePurchaseItemBody, DeletePurchaseItemParams, EditPurchaseItemParams, FetchDbPurchaseItem, FetchPurchaseItemParams, PurchaseItemCountResult, UpdatePurchaseItemParams } from "./purchaseitems.types";
import { PoolClient } from "pg";

export default class PurchaseItemService {

  async createPurchaseItems(data: CreatePurchaseItemParams, client: PoolClient) {

    const {
      branch_id,
      firm_id,
      purchase_id,
      product_id,
      purchased_qty,
      received_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      stock_id,
      remark,
      statusCode
    } = data;



    const purchaseItemQuery = `
    INSERT INTO purchase_items (
      firm_id,
      purchase_id,
      product_id,
      purchased_qty,
      received_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      stock_id,
      remarks,
      status
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
    )
    RETURNING *;
  `;

    const values = [
      firm_id,
      purchase_id,
      product_id,
      purchased_qty,
      received_qty ?? 0,
      unit,
      unit_price,
      sub_total,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      net_amount,
      stock_id ?? null,
      remark ?? null,
      statusCode
    ];

    const { rows } = await executeInTransaction(client, purchaseItemQuery, values);

    return rows[0];
  }

  async fetchPurchaseItems(data: FetchPurchaseItemParams) {

    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters?.purchase_id) {
      values.push(filters.purchase_id);
      where.push(`purchase_id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`firm_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`branch_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseItemQuery = `
  SELECT 
    pi.*,
    p.name AS product_name,
    pu.bill_number,
    s.batch_number
  FROM purchase_items pi
  LEFT JOIN products p ON p.id = pi.product_id
  LEFT JOIN purchases pu ON pu.id = pi.purchase_id
  LEFT JOIN stock s ON s.id = pi.stock_id
  ${whereClause}
  ORDER BY pi.id DESC
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
    SELECT COUNT(*)
    FROM purchase_items
    ${whereClause}
  `;

    const items = await query<FetchDbPurchaseItem>(
      purchaseItemQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<PurchaseItemCountResult>(countQuery, values);

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }

  async updatePurchaseItem(data: EditPurchaseItemParams, client: PoolClient) {
    const {

      branch_id,
      firm_id,
      purchased_qty,
      received_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      stock_id,
      item_id, purchase_id, remark, statusCode, product_id
    } = data;

    const is_item_exist = await getRecord(
      item_id,
      "purchase_items",
      "firm_id",
      firm_id,
      client
    );
    if (!is_item_exist) {
      throw new AppError("Purchase item not found", 404);
    }
    const final_product_id = product_id ?? is_item_exist.product_id;
    if (final_product_id !== is_item_exist.product_id) {
      const duplicateItem = await executeInTransaction(
        client,
        `SELECT id
         FROM purchase_items
         WHERE purchase_id = $1
         AND firm_id = $2
         AND product_id = $3
         AND id != $4
         AND status != 0
         LIMIT 1`,
        [purchase_id, firm_id, final_product_id, item_id]
      );

      if (duplicateItem.rows.length > 0) {
        throw new AppError("This item already exists in this purchase", 400);
      }
    }
    const final_received_qty = received_qty ?? is_item_exist.received_qty;
    const final_purchased_qty = purchased_qty ?? is_item_exist.purchased_qty;
    if (final_received_qty > final_purchased_qty) {
      throw new AppError(
        "Received quantity cannot exceed purchased quantity",
        422
      );
    }
    const updateQuery = `
      UPDATE purchase_items
    SET
    purchased_qty = $1,
      received_qty = $2,
      unit = $3,
      unit_price = $4,
      sub_total = $5,
      total_cgst = $6,
      total_sgst = $7,
      total_igst = $8,
      net_amount = $9,
      product_id = $10,
      stock_id = $11,
      remarks =
        CASE
          WHEN remarks IS NULL THEN $12:: jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $12:: jsonb
          ELSE jsonb_build_array(remarks) || $12:: jsonb
    END
      WHERE id = $13 AND firm_id =$14
    RETURNING *;
    `;

    const values = [
      purchased_qty ?? is_item_exist.purchased_qty,
      received_qty ?? is_item_exist.received_qty,
      unit ?? is_item_exist.unit,
      unit_price ?? is_item_exist.unit_price,
      sub_total ?? is_item_exist.sub_total,
      total_cgst ?? is_item_exist.total_cgst,
      total_sgst ?? is_item_exist.total_sgst,
      total_igst ?? is_item_exist.total_igst,
      net_amount ?? is_item_exist.net_amount,
      final_product_id,
      stock_id ?? is_item_exist.stock_id,
      JSON.stringify(remark),
      item_id,
      firm_id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return rows[0];
  }

  async deletePurchaseItem(data: DeletePurchaseItemParams, client: PoolClient) {

    const { purchase_id, firm_id, item_id, remark } = data;
    const isItemExist = await executeInTransaction(client,
      `SELECT * FROM purchase_items
       WHERE purchase_id = $1
       AND firm_id = $2
       AND status != 0
       ${item_id ? "AND id = $3" : ""}`,
      item_id ? [purchase_id, firm_id, item_id] : [purchase_id, firm_id]
    )
    if (isItemExist.rows.length === 0) {
      throw new AppError("Purchase item not found for this purchase", 404)
    }

    const deleteQuery = `
      UPDATE purchase_items
SET 
  status = 0,
  remarks = CASE
    WHEN remarks IS NULL THEN $1::jsonb
    WHEN jsonb_typeof(remarks) = 'array'
      THEN remarks || $1::jsonb
    ELSE jsonb_build_array(remarks) || $1::jsonb
  END
WHERE purchase_id = $2 
  AND firm_id = $3
  ${item_id ? "AND id = $4" : ""}
RETURNING *;
    `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      item_id ? [JSON.stringify(remark), purchase_id, firm_id, item_id] : [JSON.stringify(remark), purchase_id, firm_id]
    );

    return rows[0];
  }
  async fetchItemsOnly(client: PoolClient, firm_id: number, sale_id: number) {
    const { rows } = await executeInTransaction(client,
      `SELECT * FROM purchase_items WHERE purchase_id = $1 AND
      firm_id =$2 AND status !=$3`,
      [sale_id, firm_id, getStatusCode("Deleted")]
    )
    return rows[0]
  }
}
