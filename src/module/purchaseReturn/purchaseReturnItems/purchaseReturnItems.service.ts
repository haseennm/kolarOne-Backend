import { getRecord } from "../../../utils/extra";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { PoolClient } from "pg";
import { CreatePurchaseReturnItemParams, DeletePurchaseReturnItemParams, EditPurchaseReturnItemParams, FetchDbPurchaseReturnItem, FetchPurchaseReturnItemParams, PurchaseReturnItemCountResult } from "./purchaseReturnItems.types";

export default class PurchaseReturnItemService {

  async createPurchaseReturnItems(data: CreatePurchaseReturnItemParams, client: PoolClient) {

    const {
      firm_id,
      purchase_return_id,
      product_id,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      stock_id,
      remark,
      statusCode, returned_qty, purchase_item_id
    } = data;

    const check_exist_return = await getRecord(
      purchase_return_id, "purchase_return", "firm_id", firm_id, client
    )
    if (!check_exist_return) throw new AppError("Purchase return not found.", 404)
    if (stock_id) {
      const check_exist_stock = await getRecord(
        stock_id, "stock", "firm_id", firm_id, client
      )
      if (!check_exist_stock) throw new AppError("Stock not found.", 404)
    }
    const check_exist_purchase_item = await getRecord(
      purchase_item_id, "purchase_items", "firm_id", firm_id, client
    )


    if (!check_exist_purchase_item) throw new AppError("Purchase return not found.", 404)

    const purchased_qty = Number(check_exist_purchase_item.received_qty);
    const returnedQtyQuery = `
  SELECT COALESCE(SUM(returned_qty), 0) AS total_returned
  FROM purchase_return_items
  WHERE purchase_item_id = $1 AND firm_id = $2 AND status =$3
`;
    const returnedQtyRes = await client.query(returnedQtyQuery, [purchase_item_id, firm_id, 0]);

    const already_returned = Number(returnedQtyRes.rows[0].total_returned);
    if (returned_qty + already_returned > purchased_qty) {
      throw new AppError(
        `Returned quantity exceeds purchased quantity. Max allowed: ${purchased_qty - already_returned}`,
        400
      );
    }
    const purchaseReturnItemQuery = `
    INSERT INTO purchase_return_items (
      firm_id,
      purchase_return_id,
      product_id,
      returned_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      stock_id,
      remarks,
      status,
      purchase_item_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
    )
    RETURNING *;
  `;

    const values = [
      firm_id,
      purchase_return_id,
      product_id,
      returned_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      net_amount,
      stock_id ?? null,
      remark ?? null,
      statusCode,
      purchase_item_id
    ];

    const { rows } = await executeInTransaction(client, purchaseReturnItemQuery, values);

    return rows[0];
  }

  async fetchPurchaseReturnItems(data: FetchPurchaseReturnItemParams) {

    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // ignore deleted
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

    const items = await query<FetchDbPurchaseReturnItem>(
      purchaseItemQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<PurchaseReturnItemCountResult>(countQuery, values);

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

  async updatePurchaseReturnItem(
    data: EditPurchaseReturnItemParams,
    client: PoolClient
  ) {
    const {
      firm_id,
      return_item_id,
      returned_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      stock_id,
      purchase_return_id,
      purchase_item_id,
      remark,
      statusCode,
      product_id
    } = data;

    // 1. Check return item exists
    const existingItem = await getRecord(
      return_item_id,
      "purchase_return_items",
      "firm_id",
      firm_id,
      client
    );
    if (!existingItem) {
      throw new AppError("Purchase return item not found", 404);
    }

    // 2. Validate purchase return
    const purchaseReturn = await getRecord(
      purchase_return_id,
      "purchase_return",
      "firm_id",
      firm_id,
      client
    );
    if (!purchaseReturn) {
      throw new AppError("Purchase return not found", 404);
    }

    // 3. Validate purchase item
    const purchaseItem = await getRecord(
      purchase_item_id,
      "purchase_items",
      "firm_id",
      firm_id,
      client
    );
    if (!purchaseItem) {
      throw new AppError("Purchase item not found", 404);
    }

    // 4. Validate stock (optional)
    if (stock_id) {
      const stock = await getRecord(
        stock_id,
        "stock",
        "firm_id",
        firm_id,
        client
      );
      if (!stock) {
        throw new AppError("Stock not found", 404);
      }
    }

    const purchased_qty = Number(purchaseItem.received_qty);

    const returnedQtyQuery = `
  SELECT COALESCE(SUM(returned_qty), 0) AS total_returned
  FROM purchase_return_items
  WHERE purchase_item_id = $1
    AND firm_id = $2
    AND status = $3
    AND id != $4
`;

    const returnedQtyRes = await client.query(returnedQtyQuery, [
      purchase_item_id,
      firm_id,
      0,
      return_item_id
    ]);

    const already_returned = Number(
      returnedQtyRes.rows[0].total_returned
    );

    const newQty = returned_qty;

    if (newQty <= 0) {
      throw new AppError("Returned quantity must be greater than 0", 400);
    }

    if (newQty + already_returned > purchased_qty) {
      throw new AppError(
        `Returned quantity exceeds limit. Max allowed: ${purchased_qty - already_returned
        }`,
        400
      );
    }

    // 6. Update query
    const updateQuery = `
    UPDATE purchase_return_items
    SET
      product_id = $1,
      returned_qty = $2,
      unit = $3,
      unit_price = $4,
      sub_total = $5,
      total_cgst = $6,
      total_sgst = $7,
      total_igst = $8,
      net_amount = $9,
      stock_id = $10,
      remarks =
        CASE
          WHEN remarks IS NULL THEN $11::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $11::jsonb
          ELSE jsonb_build_array(remarks) || $11::jsonb
        END,
      status = $12
    WHERE id = $13 AND firm_id = $14
    RETURNING *;
  `;

    const values = [
      product_id ?? existingItem.product_id,
      returned_qty,
      unit ?? existingItem.unit,
      unit_price ?? existingItem.unit_price,
      sub_total ?? existingItem.sub_total,
      total_cgst ?? existingItem.total_cgst,
      total_sgst ?? existingItem.total_sgst,
      total_igst ?? existingItem.total_igst,
      net_amount ?? existingItem.net_amount,
      stock_id ?? existingItem.stock_id,
      JSON.stringify(remark),
      statusCode ?? existingItem.status,
      return_item_id,
      firm_id
    ];

    const { rows } = await executeInTransaction(
      client,
      updateQuery,
      values
    );
    let movement_type: "O" | "I" =
      returned_qty > existingItem.returned_qty ? "O" : "I";
    return { row: rows[0], movement_type };
  }

  async deletePurchaseReturnItem(data: DeletePurchaseReturnItemParams, client: PoolClient) {
    const { purchase_id, firm_id, remark } = data;
    const isItemExist = await executeInTransaction(client,
      `SELECT * FROM purchase_items WHERE purchase_id =$1 AND firm_id= $2`,
      [purchase_id, firm_id]
    )
    if (isItemExist) {
      throw new AppError("Purchase item not found for this purchase", 404)
    }

    const deleteQuery = `
        UPDATE purchase_items
        SET status = 0
        WHERE purchase_id = $1 AND firm_id = $2
    RETURNING *;
    `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [purchase_id, firm_id]
    );

    return rows[0];
  }
}