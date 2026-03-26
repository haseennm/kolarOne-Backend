import { getRecord } from "../../../utils/extra";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { CreateSaleItemParams, DeleteSaleItemBody, DeleteSaleItemParams, EditSaleItemParams, FetchDbSaleItem, FetchSaleItemParams, SaleItemCountResult, UpdateSaleItemParams } from "./saleitems.types";
import { PoolClient } from "pg";

export default class SaleItemService {

  async createSaleItems(data: CreateSaleItemParams, client: PoolClient) {

    const {
      firm_id,
      product_id,
      discount,
      final_amount,
      sale_id,
      saled_qty,
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



    const saleItemQuery = `
    INSERT INTO sales_items (
      firm_id,
      sale_id,
      product_id,
      unit,
      unit_price,
      saled_qty,
      sub_total,
      discount,
      net_amount,
      total_cgst,
      total_sgst,
      total_igst,
      final_amount,
      stock_id,
      remarks,
      status
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    )
    RETURNING *;
  `;

    const values = [
      firm_id,
      sale_id,
      product_id,
      unit,
      unit_price,
      saled_qty,
      sub_total,
      discount,
      net_amount,
      total_cgst,
      total_sgst,
      total_igst,
      final_amount,
      stock_id,
      JSON.stringify(remark ?? {}),
      statusCode
    ];

    const { rows } = await executeInTransaction(client, saleItemQuery, values);

    return rows[0];
  }

  async fetchSaleItems(data: FetchSaleItemParams) {

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

    if (filters?.sale_id) {
      values.push(filters.sale_id);
      where.push(`sale_id = $${values.length}`);
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

    const saleItemQuery = `
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

    const items = await query<FetchDbSaleItem>(
      saleItemQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<SaleItemCountResult>(countQuery, values);

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

  async updateSaleItem(data: EditSaleItemParams, client: PoolClient) {
    const {
      branch_id,
      firm_id,
      saled_qty,
      unit,
      unit_price,
      sub_total,
      total_cgst,
      total_sgst,
      total_igst,
      net_amount,
      stock_id,
      discount,
      final_amount,
      item_id,
      sale_id,
      remark,
      statusCode,
      product_id
    } = data;

    // ✅ Validation: Check sale item existence
    const is_item_exist = await getRecord(
      item_id,
      "sales_items",
      "firm_id",
      firm_id,
      client
    );
    if (!is_item_exist) {
      throw new AppError("Sale item not found", 404);
    }

    // ✅ Validation: Quantity validation
    if (saled_qty && saled_qty <= 0) {
      throw new AppError("Saled quantity must be greater than 0", 422);
    }

    const updateQuery = `
      UPDATE sales_items
      SET
        product_id = $1,
        saled_qty = $2,
        unit = $3,
        unit_price = $4,
        sub_total = $5,
        discount = $6,
        net_amount = $7,
        total_cgst = $8,
        total_sgst = $9,
        total_igst = $10,
        final_amount = $11,
        stock_id = $12,
        remarks = COALESCE(remarks, '[]'::jsonb) || $13::jsonb,
        status = $14
      WHERE id = $15 AND firm_id = $16
      RETURNING *;
    `;

    const values = [
      product_id ?? is_item_exist.product_id,
      saled_qty ?? is_item_exist.saled_qty,
      unit ?? is_item_exist.unit,
      unit_price ?? is_item_exist.unit_price,
      sub_total ?? is_item_exist.sub_total,
      discount ?? is_item_exist.discount,
      net_amount ?? is_item_exist.net_amount,
      total_cgst ?? is_item_exist.total_cgst,
      total_sgst ?? is_item_exist.total_sgst,
      total_igst ?? is_item_exist.total_igst,
      final_amount ?? is_item_exist.final_amount,
      stock_id ?? is_item_exist.stock_id,
      JSON.stringify([remark]),
      statusCode ?? is_item_exist.status,
      item_id,
      firm_id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return rows[0];
  }

  async deleteSaleItem(data: DeleteSaleItemParams, client: PoolClient) {

    const { sale_id, firm_id, remark } = data;
    const isItemExist = await executeInTransaction(client,
      `SELECT * FROM purchase_items WHERE sale_id =$1 AND firm_id= $2`,
      [sale_id, firm_id]
    )
    if (isItemExist) {
      throw new AppError("Sale item not found for this Sale", 404)
    }

    const deleteQuery = `
        UPDATE sales_items
        SET status = 0
        WHERE sale_id = $1 AND firm_id = $2
    RETURNING *;
    `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [sale_id, firm_id]
    );

    return rows[0];
  }
}