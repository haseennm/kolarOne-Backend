import { isExist } from "../../../utils/extra";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { CreatePurchaseItemParams, DeletePurchaseItemBody, FetchDbPurchaseItem, FetchPurchaseItemParams, PurchaseItemCountResult, UpdatePurchaseItemParams } from "./purchaseitems.types";
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

  async updatePurchaseItem(data: UpdatePurchaseItemParams, remark: object, client: PoolClient) {
    const {
      id,
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
      stock_id
    } = data;

    // 1. Validate firm existence (requirement)
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

    // 2. Validate purchase item exists and belongs to the firm
    const isItemExist = await isExist(
      id,
      "purchase_items",
      "firm_id",
      firm_id,
      client
    );
    if (!isItemExist) {
      throw new AppError("Purchase item not found", 404);
    }


    // 4. Parameterized UPDATE query
    const updateQuery = `
      UPDATE purchase_items
      SET
        purchased_qty = $1,
        received_qty   = $2,
        unit           = $3,
        unit_price     = $4,
        sub_total      = $5,
        total_cgst     = $6,
        total_sgst     = $7,
        total_igst     = $8,
        net_amount     = $9,
        stock_id       = $10,
         remarks =
        CASE
          WHEN remarks IS NULL THEN $11::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $11::jsonb
          ELSE jsonb_build_array(remarks) || $11::jsonb
        END
      WHERE id = $12
      RETURNING *;
    `;

    const values = [
      purchased_qty ?? isItemExist.purchased_qty,
      received_qty ?? isItemExist.received_qty,
      unit ?? isItemExist.unit,
      unit_price ?? isItemExist.unit_price,
      sub_total ?? isItemExist.sub_total,
      total_cgst ?? isItemExist.total_cgst,
      total_sgst ?? isItemExist.total_sgst,
      total_igst ?? isItemExist.total_igst,
      net_amount ?? isItemExist.net_amount,
      stock_id ?? isItemExist.stock_id,
      JSON.stringify(remark),
      id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return rows[0];
  }

  async deletePurchaseItem(data: DeletePurchaseItemBody, remark: object, client: PoolClient) {

    const { id, firm_id } = data;


    const isRoleExist = await isExist(
      id,
      "role",
      "firm_id",
      firm_id,
      client
    );

    if (!isRoleExist) {
      throw new AppError("Purchase item not found or already deleted", 404);
    }

    const deleteQuery = `
        UPDATE purchase_items
        SET status = 0
        WHERE id = $1 AND firm_id = $2
        RETURNING *;
      `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [, firm_id]
    );

    return rows[0];
  }
}