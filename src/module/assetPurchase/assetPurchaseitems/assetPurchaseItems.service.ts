import { getRecord, getStatusCode } from "../../../utils/extra";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import {
  CreateAssetPurchaseItemParams,
  DeleteAssetPurchaseItemParams,
  EditAssetPurchaseItemParams,
  FetchDbAssetPurchaseItem,
  FetchAssetPurchaseItemParams,
  AssetPurchaseItemCountResult
} from "./assetPurchaseItems.types";
import { PoolClient } from "pg";

export default class AssetPurchaseItemService {

  async createAssetPurchaseItems(data: CreateAssetPurchaseItemParams, client: PoolClient) {
    const {
      branch_id,
      firm_id,
      asset_purchase_id,
      asset_product_id,
      purchased_qty,
      received_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      asset_stock_id,
      remark,
      statusCode
    } = data;

    const purchaseItemQuery = `
      INSERT INTO asset_purchase_items (
        asset_purchase_id,
        asset_product_id,
        purchased_qty,
        received_qty,
        unit,
        unit_price,
        sub_total,
        total_cgst,
        total_sgst,
        total_igst,
        net_amount,
        asset_stock_id,
        remarks,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *;
    `;

    const values = [
      asset_purchase_id,
      asset_product_id,
      purchased_qty,
      received_qty ?? 0,
      unit,
      unit_price,
      sub_total,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      net_amount,
      asset_stock_id ?? null,
      remark ?? null,
      statusCode
    ];

    const { rows } = await executeInTransaction(client, purchaseItemQuery, values);
    return rows[0];
  }

  async fetchAssetPurchaseItems(data: FetchAssetPurchaseItemParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`api.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`api.id = $${values.length}`);
    }

    if (filters?.asset_purchase_id) {
      values.push(filters.asset_purchase_id);
      where.push(`api.asset_purchase_id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`api.firm_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`api.branch_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseItemQuery = `
      SELECT 
        api.*,
        ap.name AS asset_product_name,
        apu.bill_number,
        ast.batch_number
      FROM asset_purchase_items api
      LEFT JOIN asset_products ap ON ap.id = api.asset_product_id
      LEFT JOIN asset_purchases apu ON apu.id = api.asset_purchase_id
      LEFT JOIN asset_stocks ast ON ast.id = api.asset_stock_id
      ${whereClause}
      ORDER BY api.id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM asset_purchase_items api
      ${whereClause}
    `;

    const items = await query<FetchDbAssetPurchaseItem>(
      purchaseItemQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<AssetPurchaseItemCountResult>(countQuery, values);

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

  async updateAssetPurchaseItem(data: EditAssetPurchaseItemParams, client: PoolClient) {
    const {

      purchased_qty,
      received_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      asset_stock_id,
      item_id,
      asset_purchase_id,
      remark,
      statusCode,
      asset_product_id
    } = data;

    const is_item_exist = await getRecord(
      item_id,
      "asset_purchase_items",
      "asset_purchase_id",
      asset_purchase_id,
      client
    );

    if (!is_item_exist) {
      throw new AppError("Asset purchase item not found", 404);
    }

    const final_asset_product_id = asset_product_id ?? is_item_exist.asset_product_id;

    if (final_asset_product_id !== is_item_exist.asset_product_id) {
      const duplicateItem = await executeInTransaction(
        client,
        `SELECT id
         FROM asset_purchase_items
         WHERE asset_purchase_id = $1
         AND asset_product_id = $2
         AND id != $3
         AND status != 4
         LIMIT 1`,
        [asset_purchase_id, final_asset_product_id, item_id, getStatusCode("Deleted")]
      );

      if (duplicateItem.rows.length > 0) {
        throw new AppError("This asset item already exists in this purchase", 400);
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
      UPDATE asset_purchase_items
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
        asset_product_id = $10,
        asset_stock_id = $11,
        remarks =
          CASE
            WHEN remarks IS NULL THEN $12::jsonb
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $12::jsonb
            ELSE jsonb_build_array(remarks) || $12::jsonb
          END
      WHERE id = $13
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
      final_asset_product_id,
      asset_stock_id ?? is_item_exist.asset_stock_id,
      JSON.stringify(remark),
      item_id,
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return rows[0];
  }

  async deleteAssetPurchaseItem(data: DeleteAssetPurchaseItemParams, client: PoolClient) {
    const { asset_purchase_id, item_id, remark } = data;

    const isItemExist = await executeInTransaction(
      client,
      `SELECT * FROM asset_purchase_items
       WHERE asset_purchase_id = $1
       AND status != $2
      AND id = $3`,
      [asset_purchase_id, getStatusCode("Deleted"), item_id]
    );

    if (isItemExist.rows.length === 0) {
      throw new AppError("Asset purchase item not found for this purchase", 404);
    }

    const deleteQuery = `
      UPDATE asset_purchase_items
      SET 
        status = $1,
        remarks = CASE
          WHEN remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $2::jsonb
          ELSE jsonb_build_array(remarks) || $2::jsonb
        END
      WHERE asset_purchase_id = $3
       AND id =$4
      RETURNING *;
    `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [getStatusCode("Deleted"), JSON.stringify(remark), asset_purchase_id, item_id]
    );

    return rows[0];
  }

  async fetchAssetItemsOnly(client: PoolClient, asset_purchase_id: number) {
    const { rows } = await executeInTransaction(
      client,
      `SELECT * FROM asset_purchase_items 
       WHERE asset_purchase_id = $1 
       AND status != $2`,
      [asset_purchase_id, getStatusCode("Deleted")]
    );
    return rows[0];
  }
}