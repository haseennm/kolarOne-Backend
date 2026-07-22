import { json } from "node:stream/consumers";
import { executeInTransaction, query } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { getRecord, getStatusCode } from "../../../utils/extra";
import { ChangeQuotationItemStatus, CreateQuotationItemParams, DeleteQuotationItemBody, DeleteQuotationItemParams, EditQuotationItemParams, FetchDbQuotationItem, FetchQuotationItemParams, QuotationItemCountResult, UpdateQuotationItemParams } from "./quotationItems.types";
import { PoolClient } from "pg";

export default class QuotationItemService {

  async createQuotationItems(data: CreateQuotationItemParams, client: PoolClient) {

    const {
      firm_id,
      product_id,
      discount,
      final_amount,
      quotation_id,
      quotation_qty,
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

    const quotationItemQuery = `
    INSERT INTO quotation_items (
      firm_id,
      quotation_id,
      product_id,
      unit,
      unit_price,
      quotation_qty,
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
      quotation_id,
      product_id,
      unit,
      unit_price,
      quotation_qty,
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

    const { rows } = await executeInTransaction(client, quotationItemQuery, values);

    return rows[0];
  }

  async fetchQuotationItems(data: FetchQuotationItemParams) {

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

    if (filters?.quotation_id) {
      values.push(filters.quotation_id);
      where.push(`quotation_id = $${values.length}`);
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

    const quotationItemQuery = `
  SELECT 
    qi.*,
    p.name AS product_name,
    q.invoice_number,
    s.batch_number
  FROM quotation_items si
  LEFT JOIN products p ON p.id = qi.product_id
  LEFT JOIN quotations q ON q.id = qi.quotation_id
  LEFT JOIN stock s ON s.id = qi.stock_id
  ${whereClause}
  ORDER BY qi.id DESC
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
    SELECT COUNT(*)
    FROM quotations
    ${whereClause}
  `;

    const items = await query<FetchDbQuotationItem>(
      quotationItemQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<QuotationItemCountResult>(countQuery, values);

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

  async updateQuotationItem(data: EditQuotationItemParams, client: PoolClient) {
    const {
      branch_id,
      firm_id,
      quotation_qty,
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
      quotation_id,
      remark,
      statusCode,
      product_id
    } = data;

    const is_item_exist = await getRecord(
      item_id,
      "quotations",
      "firm_id",
      firm_id,
      client
    );
    if (!is_item_exist) {
      throw new AppError("quotation item not found", 404);
    }

    // ✅ Validation: Quantity validation
    if (quotation_qty && quotation_qty <= 0) {
      throw new AppError("quotation quantity must be greater than 0", 422);
    }

    const updateQuery = `
      UPDATE quotation_items
      SET
        product_id = $1,
        quotation_qty = $2,
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
      WHERE id = $15 AND firm_id = $16 AND quotation_id =$17
      RETURNING *;
    `;

    const values = [
      product_id ?? is_item_exist.product_id,
      quotation_qty ?? is_item_exist.quotation_qty,
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
      firm_id,
      quotation_id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return {
      new_row: rows[0],
      old_row: is_item_exist
    };
  }

  async deleteQuotationItem(data: DeleteQuotationItemParams, client: PoolClient) {

    const { quotation_id, firm_id, remark } = data;
    const isItemExist = await executeInTransaction(client,
      `SELECT * FROM quotation_items WHERE quotation_id =$1 AND firm_id= $2`,
      [quotation_id, firm_id]
    )
    if (!isItemExist) {
      throw new AppError("Quotations item not found for this Quotation", 404)
    }

    const deleteQuery = `
        UPDATE quotation_items
        SET status = 0,
         remarks = COALESCE(remarks, '[]'::jsonb) || $1::jsonb,
        WHERE quotation_id = $2 AND firm_id = $3
    RETURNING *;
    `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [
        JSON.stringify([remark]),
        quotation_id,
        firm_id
      ]
    );

    return rows[0];
  }
  async changeQuotationItemStatus(data: ChangeQuotationItemStatus, client: PoolClient) {

    const { quotation_id, firm_id, remark, status } = data;
    const isItemExist = await executeInTransaction(client,
      `SELECT * FROM quotation_items WHERE quotation_id =$1 AND firm_id= $2`,
      [quotation_id, firm_id]
    )
    if (!isItemExist) {
      throw new AppError("Quotations item not found for this Quotation", 404)
    }

    const deleteQuery = `
        UPDATE quotation_items
        SET status = $1,
         remarks = COALESCE(remarks, '[]'::jsonb) || $2::jsonb,
        WHERE quotation_id = $3 AND firm_id = $4
    RETURNING *;
    `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [
        status,
        JSON.stringify([remark]),
        quotation_id,
        firm_id
      ]
    );

    return rows[0];
  }
   async fetchItemsOnly(client: PoolClient, firm_id: number, quotation_id: number) {
      const { rows } = await executeInTransaction(client,
        `SELECT * FROM quotation_items WHERE quotation_id = $1 AND
        firm_id =$2 AND status !=$3`,
        [quotation_id, firm_id, getStatusCode("Deleted")]
      )
      return rows[0]
    }
}