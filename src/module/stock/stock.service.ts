import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { isExist } from "../../utils/extra";
import { StockCreateBody, StockCreateParams, StockDelete, StockFetchParams } from "./stock.types";

export default class StockService {

  async createStock(data: StockCreateParams, client: any) {
    const {
      available_qty,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      purchase_id,
      purchased_qty,
      statusCode,
      movement_type,
      reason,
      company_id
    } = data;

    // ✅ Validate firm exists
    const isFirmExist = await isExist(
      firm_id,
      "firm",
      "branch_id",
      branch_id,
      client
    );

    if (!isFirmExist) {
      throw new AppError("Firm not found", 404);
    }
    const is_product_exist = await isExist(
      product_id,
      "products",
      "company_id",
      company_id,
      client
    );

    if (!is_product_exist) {
      throw new AppError("Product not found", 404);
    }

    const lastStock = await executeInTransaction(
  client,
  `
  SELECT MAX(batch_num) AS last_batch FROM (
    SELECT CAST(SUBSTRING(batch_number FROM 7) AS INTEGER) AS batch_num
    FROM stock
    WHERE branch_id = $1
    FOR UPDATE
  ) AS locked_rows
  `,
  [branch_id]
);

const nextBatch = (lastStock.rows[0]?.last_batch || 0) + 1;
const batch_number = `BATCH-${nextBatch}`;


    // ✅ Insert into stock table
    const stockQuery = `
    INSERT INTO stock (
      available_quantity,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      purchase_id,
      purchased_qty,
      status,
      batch_number
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8 ,$9)
    RETURNING *;
  `;

    const values = [
      available_qty,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      purchase_id,
      purchased_qty,
      statusCode,
      batch_number
    ];

    const { rows } = await executeInTransaction(client, stockQuery, values);

    const stock_id = rows[0].id;
    const movement_query = `
    INSERT INTO stock_movements (
      product_id,
      branch_id,
      movement_type,
      quantity,
      reason,
      stock_id,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *;
  `;

    const movement_values = [
      product_id,
      branch_id,
      movement_type,
      available_qty,
      reason,
      stock_id,
      statusCode
    ];

    await executeInTransaction(client, movement_query, movement_values);
    return rows[0]
  }

  async fetchStock(data: StockFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // ❌ Exclude deleted
    values.push(0);
    where.push(`status != $${values.length}`);

    // ✅ ID filter
    if (filters?.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    // ✅ Firm
    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`firm_id = $${values.length}`);
    }

    // ✅ Branch
    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`branch_id = $${values.length}`);
    }

    // ✅ Company
    values.push(filters.company_id);
    where.push(`company_id = $${values.length}`);

    // ✅ Status filter
    if (filters?.status !== undefined) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }

    // ✅ Available Qty range
    if (filters?.available_qty_min !== undefined) {
      values.push(filters.available_qty_min);
      where.push(`available_qty >= $${values.length}`);
    }

    if (filters?.available_qty_max !== undefined) {
      values.push(filters.available_qty_max);
      where.push(`available_qty <= $${values.length}`);
    }

    // ✅ Purchased Qty range
    if (filters?.purchased_qty_min !== undefined) {
      values.push(filters.purchased_qty_min);
      where.push(`purchased_qty >= $${values.length}`);
    }

    if (filters?.purchased_qty_max !== undefined) {
      values.push(filters.purchased_qty_max);
      where.push(`purchased_qty <= $${values.length}`);
    }

    // ✅ Search (example: batch_number)
    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
  s.batch_number ILIKE $${values.length}
  OR p.name ILIKE $${values.length}
)`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ✅ Sorting
    const sortBy = filters.sort_by || "id";
    const sortOrder = filters.sort_order === "asc" ? "ASC" : "DESC";

    const stockQuery = `
  SELECT 
    s.*, 
    p.product_name
  FROM stock s
  LEFT JOIN products p ON s.product_id = p.id
  ${whereClause}
  ORDER BY ${sortBy} ${sortOrder}
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
    SELECT COUNT(*)
    FROM stock
    ${whereClause}
  `;
    const limit = filters.limit ?? 50
    const stocks = await query(stockQuery, [
      ...values,
      limit,
      offset
    ]);

    const total = await query(countQuery, values);

    return {
      stocks,
      pagination: {
        page: filters.page,
        limit: limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / limit),
      },
    };
  }

  // async updateRole(data: EditRoleParams, client: any) {

  //   const { id, role, description, company_id, statusCode } = data;

  //   const isRoleExist = await isExist(
  //     id,
  //     "role",
  //     "company_id",
  //     company_id,
  //     client
  //   );

  //   if (!isRoleExist) {
  //     throw new AppError("Role not found", 404);
  //   }

  //   const status =
  //     statusCode === 99
  //       ? isRoleExist.status
  //       : statusCode;

  //   const updateQuery = `
  //     UPDATE role
  //     SET
  //       role = $1,
  //       description = $2,
  //       status = $3
  //     WHERE id = $4
  //     RETURNING *;
  //   `;

  //   const values = [
  //     role ?? isRoleExist.role,
  //     description ?? isRoleExist.description,
  //     status,
  //     id
  //   ];

  //   const { rows } = await executeInTransaction(client, updateQuery, values);

  //   return rows[0];
  // }

  async deleteStock(data: StockDelete, client: PoolClient) {

    const { id, branch_id } = data;


    const is_stock_exist = await isExist(
      id,
      "stock",
      "branch_id",
      branch_id,
      client
    );

    if (!is_stock_exist) {
      throw new AppError("Stock not found or already deleted", 404);
    }

    const deleteQuery = `
        UPDATE stock
        SET status = 0
        WHERE id = $1
        RETURNING *;
      `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [id]
    );
    const delete_movement_query = `
        UPDATE stock_movements
        SET status = 0
        WHERE stock_id = $1
        RETURNING *;
      `;

    await executeInTransaction(
      client,
      delete_movement_query, [id]
    );

    return rows[0];


  }
}