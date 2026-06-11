import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord } from "../../utils/extra";
import { StockAdditionalParams, StockAdjustFetchParams, StockChangeBody, StockChangeParams, StockCreateBody, StockCreateParams, StockDelete, StockEditParams, StockFetchParams, StockPriceSet, StockQtyChangeBody, StockReport } from "./stock.types";

const generateBarcode = (): string => {
  return Math.floor(10000000000 + Math.random() * 90000000000).toString();
};

const generateUniqueBarcode = async (
  client: PoolClient
): Promise<string> => {
  let barcode: string;
  let exists = true;

  while (exists) {
    barcode = generateBarcode();

    const result = await executeInTransaction(
      client,
      `SELECT id FROM stock WHERE barcode = $1 LIMIT 1`,
      [barcode]
    );

    exists = result.rows.length > 0;
  }

  return barcode!;
};
export default class StockService {

  async createStock(data: StockCreateParams, client: PoolClient) {
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
    const isFirmExist = await getRecord(
      firm_id,
      "firm",
      "branch_id",
      branch_id,
      client
    );

    if (!isFirmExist) {
      throw new AppError("Firm not found", 404);
    }
    const is_product_exist = await getRecord(
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
    const barcode = await generateUniqueBarcode(client);
    const nextBatch = (lastStock.rows[0]?.last_batch || 0) + 1;
    const batch_number = `BATCH-${nextBatch}`;

    const stockQuery = `
  INSERT INTO stock (
    available_quantity,
    branch_id,
    selling_price,
    firm_id,
    product_id,
    purchase_id,
    status,
    batch_number,
    purchased_qty,
    barcode
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  RETURNING *;
`;

    const values = [
      available_qty,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      purchase_id,
      statusCode,
      batch_number,
      purchased_qty, barcode
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
  async editStock(data: StockEditParams, client: PoolClient) {
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
      company_id,
      stock_id
    } = data;

    const is_stock_exist = await getRecord(
      stock_id,
      "stock",
      "branch_id",
      branch_id,
      client
    );

    if (!is_stock_exist) {
      throw new AppError("Firm not found", 404);
    }
    if (product_id && product_id !== is_stock_exist.product_id) {
      const is_product_exist = await getRecord(
        product_id,
        "products",
        "company_id",
        company_id,
        client
      );

      if (!is_product_exist) {
        throw new AppError("Product not found", 404);
      }
    }
    const finalAvailableQty = available_qty ?? is_stock_exist.available_quantity;
    const finalPurchasedQty = purchased_qty ?? is_stock_exist.purchased_qty;

    if (finalAvailableQty > finalPurchasedQty) {
      throw new AppError(
        "Available quantity cannot exceed purchased quantity",
        422
      );
    }
    const stockQuery = `
  UPDATE stock SET
    available_quantity = $1,
    status = $2,
    selling_price = $3,
    product_id = $4,
    purchase_id = $5,
    purchased_qty = $6
    
  WHERE id = $7
  AND firm_id = $8
    AND branch_id = $9
  RETURNING *;
`;
    const sold_qty = Number(is_stock_exist.purchased_qty) - Number(is_stock_exist.available_quantity);
    const new_available_qty = Number(available_qty) - Number(sold_qty)
    const values = [
      new_available_qty ?? is_stock_exist.available_quantity,
      statusCode ?? is_stock_exist.status,
      selling_price ?? is_stock_exist.selling_price,
      product_id ?? is_stock_exist.product_id,
      purchase_id ?? is_stock_exist.purchase_id,
      purchased_qty ?? is_stock_exist.purchased_qty,
      stock_id,
      firm_id,
      branch_id
    ];

    const { rows } = await executeInTransaction(client, stockQuery, values);

    const movement_query = `
  UPDATE stock_movements SET
    product_id = $1,
    branch_id = $2,
    movement_type = $3,
    quantity = $4,
    status = $5
    WHERE stock_id = $6
    AND reason = $7
    AND branch_id = $8
  RETURNING *;
`;

    const movement_values = [
      product_id,
      branch_id,
      movement_type,
      available_qty,
      statusCode,
      stock_id,
      reason,
      branch_id
    ];

    await executeInTransaction(client, movement_query, movement_values);
    return rows[0]
  }
  async changeStock(data: StockChangeParams, client: PoolClient) {
    const {
      branch_id,
      firm_id,
      statusCode,
      movement_type,
      reason,
      stock_id,
      qty,
      is_relate_purchase,
      return_mode
    } = data;
    const stock = await getRecord(
      stock_id,
      "stock",
      "branch_id",
      branch_id,
      client
    );

    if (!stock) {
      throw new AppError("Stock not found", 404);
    }

    if (movement_type === "O" && stock.available_quantity < qty) {
      throw new AppError(
        `Insufficient stock in ${stock.batch_number}`,
        409
      );
    }

    const qtyNum = Number(qty);
    const stockQty = Number(stock.available_quantity);

    const calculation = movement_type === "O" ? -qtyNum : qtyNum;

    const finalAvailableQty = stockQty + calculation;

    console.log("finalAvailableQty", finalAvailableQty);
    const finalPurchasedQty = is_relate_purchase
      ? Number(stock.purchased_qty) + calculation
      : Number(stock.purchased_qty);

    console.log("finalPurchasedQty", finalPurchasedQty)
    if (finalAvailableQty > finalPurchasedQty) {
      throw new AppError(
        "Available quantity cannot exceed purchased quantity",
        422
      );
    }

    if (finalAvailableQty < 0) {
      throw new AppError("Stock cannot be negative", 422);
    }

    let updatedStock = stock; // 👈 default return

    if (return_mode !== "to_damage") {
      const { rows } = await executeInTransaction(
        client,
        `
      UPDATE stock SET
        available_quantity = $1,
        purchased_qty = $2
      WHERE id = $3
        AND firm_id = $4
        AND branch_id = $5
      RETURNING *;
      `,
        [
          finalAvailableQty,
          finalPurchasedQty,
          stock_id,
          firm_id,
          branch_id
        ]
      );

      updatedStock = rows[0]; // 👈 override only if updated
    }
    // ✅ Always insert movement
    await executeInTransaction(
      client,
      `
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
    `,
      [
        stock.product_id,
        branch_id,
        movement_type,
        qty,
        reason,
        stock_id,
        statusCode
      ]
    );

    return updatedStock;
  }

  async fetchStock(data: StockFetchParams) {
    const { filters, offset } = data;
    let where: string[] = [];
    let values: any[] = [];

    values.push(0);
    where.push(`s.status != $${values.length}`);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`s.id = $${values.length}`);
    }
    if (filters?.product_id) {
      values.push(filters.product_id);
      where.push(`s.product_id = $${values.length}`);
    }
    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`s.firm_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`s.branch_id = $${values.length}`);
    }

    values.push(filters.company_id);
    where.push(`b.company_id = $${values.length}`);

    if (filters?.status !== undefined) {
      values.push(filters.status);
      where.push(`s.status = $${values.length}`);
    }
    if (filters?.barcode) {
      values.push(filters.barcode);
      where.push(`s.barcode = $${values.length}`);
    }

    if (filters?.available_qty_min !== undefined) {
      values.push(filters.available_qty_min);
      where.push(`s.available_quantity >= $${values.length}`);
    }

    if (filters?.available_qty_max !== undefined) {
      values.push(filters.available_qty_max);
      where.push(`s.available_quantity <= $${values.length}`);
    }

    if (filters?.purchased_qty_min !== undefined) {
      values.push(filters.purchased_qty_min);
      where.push(`s.purchased_qty >= $${values.length}`);
    }

    if (filters?.purchased_qty_max !== undefined) {
      values.push(filters.purchased_qty_max);
      where.push(`s.purchased_qty <= $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
  s.batch_number ILIKE $${values.length}
  OR p.name ILIKE $${values.length}
  OR s.barcode ILIKE $${values.length}
)`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sortBy = filters.sort_by || "id";
    const sortOrder = filters.sort_order === "asc" ? "ASC" : "DESC";

    const stockQuery = `
  SELECT 
    s.*, 
    p.name,
    f.firm_name
  FROM stock s
  LEFT JOIN products p ON s.product_id = p.id
  LEFT JOIN branches b ON s.branch_id = b.id  
  LEFT JOIN firm f ON s.firm_id = f.id  
  ${whereClause}
  ORDER BY ${sortBy} ${sortOrder}
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
  SELECT COUNT(*)
  FROM stock s
  LEFT JOIN products p ON s.product_id = p.id
  LEFT JOIN branches b ON s.branch_id = b.id
  LEFT JOIN firm f ON s.firm_id = f.id
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
  async fetchAdjustedStock(data: StockAdjustFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    // stock adjustment status
    values.push(0);
    where.push(`sa.status != $${values.length}`);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`sa.id = $${values.length}`);
    }

    if (filters?.product_id) {
      values.push(filters.product_id);
      where.push(`s.product_id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`s.firm_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`sa.branch_id = $${values.length}`);
    }

    values.push(filters.company_id);
    where.push(`b.company_id = $${values.length}`);

    if (filters?.status !== undefined) {
      values.push(filters.status);
      where.push(`sa.status = $${values.length}`);
    }

    if (filters?.barcode) {
      values.push(filters.barcode);
      where.push(`s.barcode = $${values.length}`);
    }

    if (filters?.quantity !== undefined) {
      values.push(filters.quantity);
      where.push(`sa.quantity >= $${values.length}`);
    }

    if (filters?.flow_type) {
      values.push(filters.flow_type);
      where.push(`sa.flow_type = $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);

      where.push(`(
      s.batch_number ILIKE $${values.length}
      OR p.name ILIKE $${values.length}
      OR s.barcode ILIKE $${values.length}
      OR fi.firm_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

    const sortBy = filters.sort_by || "sa.id";
    const sortOrder =
      filters.sort_order === "asc" ? "ASC" : "DESC";

    const stockQuery = `
    SELECT
      sa.*,
      s.batch_number,
      s.barcode,
      p.name AS product_name,
      fi.firm_name
    FROM stock_adjustments sa
    LEFT JOIN stocks s ON sa.stock_id = s.id
    LEFT JOIN products p ON s.product_id = p.id
    LEFT JOIN branches b ON sa.branch_id = b.id
    LEFT JOIN firm fi ON s.firm_id = fi.id
    ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM stock_adjustments sa
    LEFT JOIN stocks s ON sa.stock_id = s.id
    LEFT JOIN products p ON s.product_id = p.id
    LEFT JOIN branches b ON sa.branch_id = b.id
    LEFT JOIN firm fi ON s.firm_id = fi.id
    ${whereClause}
  `;

    const limit = filters.limit ?? 50;

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
        limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(
          Number(total[0].count) / limit
        ),
      },
    };
  }

  async deleteStock(data: StockDelete, client: PoolClient) {
    const { firm_id, purchase_id } = data;

    const result = await executeInTransaction(
      client,
      `SELECT * FROM stock WHERE purchase_id = $1 AND firm_id = $2`,
      [purchase_id, firm_id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Stock not found for this purchase", 404);
    }

    const stocks = result.rows;

    const deleteQuery = `
    UPDATE stock
    SET status = 0
    WHERE purchase_id = $1 AND firm_id = $2
    RETURNING *;
  `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [purchase_id, firm_id]
    );

    for (const stock of stocks) {
      const deleteMovementQuery = `
      UPDATE stock_movements
      SET status = 0
      WHERE stock_id = $1 AND product_id = $2 AND branch_id = $3
    `;

      await executeInTransaction(client, deleteMovementQuery, [
        stock.id,
        stock.product_id,
        stock.branch_id,
      ]);
    }

    return rows[0];
  }

  async getStockReportSummary(data: StockReport) {

    const { level, firm_id, branch_id, company_id } = data;

    return transaction(async (client) => {

      let firmIds: number[] = [];
      let branchIds: number[] = [];

      /* ================= GET IDS ================= */

      if (level === "firm") {
        firmIds = [firm_id!];

        const branches = await executeInTransaction(
          client,
          `SELECT branch_id FROM firm WHERE id = $1`,
          [firm_id]
        );
        branchIds = branches.rows.map((b: any) => b.branch_id);
      }

      if (level === "branch") {
        branchIds = [branch_id!];

        const firms = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = firms.rows.map((f: any) => f.id);
      }

      if (level === "company") {
        const branches = await executeInTransaction(
          client,
          `SELECT id FROM branches WHERE company_id = $1`,
          [company_id]
        );
        branchIds = branches.rows.map((b: any) => b.id);

        const firms = await executeInTransaction(
          client,
          `
        SELECT f.id
        FROM firm f
        JOIN branches b ON b.id = f.branch_id
        WHERE b.company_id = $1
        `,
          [company_id]
        );
        firmIds = firms.rows.map((f: any) => f.id);
      }

      if (!firmIds.length) return {};

      /* ============================================================
         🟢 STOCK TABLE REPORTS
      ============================================================ */

      // 1️⃣ Most purchased product
      const mostPurchased = await executeInTransaction(client, `
      SELECT p.id, p.name, SUM(s.purchased_qty) AS total_qty
      FROM stock s
      JOIN products p ON p.id = s.product_id
      WHERE s.firm_id = ANY($1)
      GROUP BY p.id
      ORDER BY total_qty DESC
      LIMIT 1
    `, [firmIds]);

      // 2️⃣ Least purchased product
      const leastPurchased = await executeInTransaction(client, `
      SELECT p.id, p.name, SUM(s.purchased_qty) AS total_qty
      FROM stock s
      JOIN products p ON p.id = s.product_id
      WHERE s.firm_id = ANY($1)
      GROUP BY p.id
      HAVING SUM(s.available_quantity) > 0
      ORDER BY total_qty ASC
      LIMIT 1
    `, [firmIds]);

      // 3️⃣ Low stock (<20)
      const lowStock = await executeInTransaction(client, `
      SELECT p.id, p.name, SUM(s.available_quantity) AS total_available
      FROM stock s
      JOIN products p ON p.id = s.product_id
      WHERE s.firm_id = ANY($1)
      GROUP BY p.id
      HAVING SUM(s.available_quantity) < 20
    `, [firmIds]);

      // 4️⃣ Most batches product
      const mostBatches = await executeInTransaction(client, `
      SELECT p.id, p.name, COUNT(s.id) AS batch_count
      FROM stock s
      JOIN products p ON p.id = s.product_id
      WHERE s.firm_id = ANY($1)
        AND s.available_quantity > 1
      GROUP BY p.id
      ORDER BY batch_count DESC
      LIMIT 1
    `, [firmIds]);

      /* ============================================================
         🔵 STOCK MOVEMENT REPORTS
      ============================================================ */

      // 5️⃣ Most damaged
      const mostDamaged = await executeInTransaction(client, `
      SELECT p.id, p.name, SUM(sm.quantity) AS damaged_qty
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      WHERE sm.branch_id = ANY($1)
        AND sm.status = 13
      GROUP BY p.id
      ORDER BY damaged_qty DESC
      LIMIT 1
    `, [branchIds]);

      // 6️⃣ Least damaged
      const leastDamaged = await executeInTransaction(client, `
      SELECT p.id, p.name, SUM(sm.quantity) AS damaged_qty
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      WHERE sm.branch_id = ANY($1)
        AND sm.status = 13
      GROUP BY p.id
      HAVING SUM(sm.quantity) > 0
      ORDER BY damaged_qty ASC
      LIMIT 1
    `, [branchIds]);

      // Helper function
      const getMovement = async (reason: string, order: "DESC" | "ASC") => {
        return executeInTransaction(client, `
        SELECT p.id, p.name, SUM(sm.quantity) AS qty
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.branch_id = ANY($1)
          AND sm.reason = $2
          AND sm.movement_type = 'O'
        GROUP BY p.id
        HAVING SUM(sm.quantity) > 0
        ORDER BY qty ${order}
        LIMIT 1
      `, [branchIds, reason]);
      };

      const getMovementIn = async (reason: string) => {
        return executeInTransaction(client, `
        SELECT p.id, p.name, SUM(sm.quantity) AS qty
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.branch_id = ANY($1)
          AND sm.reason = $2
          AND sm.movement_type = 'I'
        GROUP BY p.id
        ORDER BY qty DESC
        LIMIT 1
      `, [branchIds, reason]);
      };

      const mostSold = await getMovement("S", "DESC");
      const leastSold = await getMovement("S", "ASC");

      const mostSalesReturn = await getMovement("SR", "DESC");
      const leastSalesReturn = await getMovement("SR", "ASC");

      const mostPurchaseReturn = await getMovement("PR", "DESC");
      const leastPurchaseReturn = await getMovement("PR", "ASC");

      const mostAdjustment = await getMovementIn("A");

      /* ============================================================
         FINAL RESPONSE
      ============================================================ */

      return {
        stock: {
          most_purchased: mostPurchased.rows[0] || null,
          least_purchased: leastPurchased.rows[0] || null,
          low_stock_products: lowStock.rows,
          most_batches_product: mostBatches.rows[0] || null
        },
        movements: {
          most_damaged: mostDamaged.rows[0] || null,
          least_damaged: leastDamaged.rows[0] || null,
          most_sold: mostSold.rows[0] || null,
          least_sold: leastSold.rows[0] || null,
          most_sales_return: mostSalesReturn.rows[0] || null,
          least_sales_return: leastSalesReturn.rows[0] || null,
          most_purchase_return: mostPurchaseReturn.rows[0] || null,
          least_purchase_return: leastPurchaseReturn.rows[0] || null,
          most_adjusted: mostAdjustment.rows[0] || null
        }
      };
    });
  }

  async createManualStock(
    data: StockAdditionalParams,
    client: PoolClient
  ) {
    const {
      branch_id,
      selling_price,
      firm_id,
      product_id,
      qty,
      statusCode,
      reason,
      company_id,
      insert_batch_number
    } = data;

    // ✅ Validate product
    const isProductExist = await getRecord(
      product_id,
      "products",
      "company_id",
      company_id,
      client
    );

    if (!isProductExist) {
      throw new AppError("Product not found", 404);
    }

    // ✅ Validate firm
    const isFirmExist = await getRecord(
      firm_id,
      "firm",
      "branch_id",
      branch_id,
      client
    );

    if (!isFirmExist) {
      throw new AppError("Firm not found", 404);
    }

    // 🎯 SCENARIO 1 & 3 → Batch provided
    if (insert_batch_number) {
      return await this.handleBatchStock({
        batch_number: `BATCH-${insert_batch_number}`,
        branch_id,
        selling_price,
        firm_id,
        product_id,
        qty,
        statusCode,
        reason,
        client
      });
    }

    // 🎯 SCENARIO 2 → Auto batch
    return await this.createWithAutoBatch({
      branch_id,
      selling_price,
      firm_id,
      product_id,
      qty,
      statusCode,
      reason,
      client
    });
  }

  // ============================================
  // 🔹 HANDLE EXISTING OR NEW CUSTOM BATCH
  // ============================================
  private async handleBatchStock(params: any) {
    const {
      batch_number,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      qty,
      statusCode,
      reason,
      client
    } = params;

    // 🔒 Lock row if exists
    const existingStock = await executeInTransaction(
      client,
      `
      SELECT * FROM stock
      WHERE batch_number = $1 AND firm_id = $2
      FOR UPDATE;
      `,
      [batch_number, firm_id]
    );

    // ✅ SCENARIO 1 → Update existing
    if (existingStock.rows.length > 0) {
      const updatedStock = await executeInTransaction(
        client,
        `
        UPDATE stock SET
          available_quantity = available_quantity + $1,
          purchased_qty = purchased_qty + $2
        WHERE batch_number = $3 AND firm_id = $4
        RETURNING *;
        `,
        [qty, qty, batch_number, firm_id]
      );

      await this.insertMovement({
        client,
        product_id,
        branch_id,
        qty,
        reason,
        stock_id: updatedStock.rows[0].id,
        statusCode
      });

      return updatedStock.rows[0];
    }

    // ✅ SCENARIO 3 → Insert new with custom batch
    const stockInsert = await this.insertStock({
      client,
      qty,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      statusCode,
      batch_number
    });

    await this.insertMovement({
      client,
      product_id,
      branch_id,
      qty,
      reason,
      stock_id: stockInsert.id,
      statusCode
    });

    return stockInsert;
  }

  // ============================================
  // 🔹 AUTO BATCH CREATION
  // ============================================
  private async createWithAutoBatch(params: any) {
    const {
      branch_id,
      selling_price,
      firm_id,
      product_id,
      qty,
      statusCode,
      reason,
      client
    } = params;

    const lastStock = await executeInTransaction(
      client,
      `
      SELECT MAX(batch_num) AS last_batch FROM (
        SELECT CAST(SUBSTRING(batch_number FROM 7) AS INTEGER) AS batch_num
        FROM stock
        WHERE branch_id = $1
        FOR UPDATE
      ) AS locked_rows;
      `,
      [branch_id]
    );

    const nextBatch = (lastStock.rows[0]?.last_batch || 0) + 1;
    const batch_number = `BATCH-${nextBatch}`;

    const stockInsert = await this.insertStock({
      client,
      qty,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      statusCode,
      batch_number
    });

    await this.insertMovement({
      client,
      product_id,
      branch_id,
      qty,
      reason,
      stock_id: stockInsert.id,
      statusCode
    });

    return stockInsert;
  }

  // ============================================
  // 🔹 INSERT STOCK
  // ============================================
  private async insertStock(params: any) {
    const {
      client,
      qty,
      branch_id,
      selling_price,
      firm_id,
      product_id,
      statusCode,
      batch_number
    } = params;

    const result = await executeInTransaction(
      client,
      `
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
      `,
      [
        qty,
        branch_id,
        selling_price ?? 0,
        firm_id,
        product_id,
        null,
        qty,
        statusCode,
        batch_number
      ]
    );

    return result.rows[0];
  }

  // ============================================
  // 🔹 INSERT MOVEMENT
  // ============================================
  private async insertMovement(params: any) {
    const {
      client,
      product_id,
      branch_id,
      qty,
      reason,
      stock_id,
      statusCode
    } = params;

    await executeInTransaction(
      client,
      `
      INSERT INTO stock_movements (
        product_id,
        branch_id,
        movement_type,
        quantity,
        reason,
        stock_id,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7);
      `,
      [product_id, branch_id, "I", qty, reason, stock_id, statusCode]
    );
  }
  private validateValue(price: number, label: string) {
    if (price <= 0) {
      throw new AppError(`${label} must be greater than 0`, 400);
    }
  }
  async updateSellingPrice(data: StockPriceSet, client: PoolClient) {
    const { firm_id, r_id, branch_price, mrp_price, retail_price, special_retail_price, wholesale_price, } = data;
    this.validateValue(mrp_price, "MRP price");
    this.validateValue(retail_price, "Retail price");
    this.validateValue(special_retail_price, "Special retail price");
    this.validateValue(wholesale_price, "Wholesale price");
    this.validateValue(branch_price, "Branch price");

    const isStockExist = await getRecord(
      r_id,
      "stock",
      "firm_id",
      firm_id,
      client
    );

    if (!isStockExist) {
      throw new AppError("Stock not found", 404);
    }
    console.log("insert data", [branch_price, mrp_price, retail_price, special_retail_price, wholesale_price, r_id, firm_id])
  const updatedStock = await executeInTransaction(
  client,
  `
  UPDATE stock
  SET 
    branch_price = $1,
    mrp_price = $2,
    retail_price = $3,
    special_retail_price = $4,
    wholesale_price = $5
  WHERE id = $6
    AND firm_id = $7
  RETURNING *;
  `,
  [
    branch_price,
    mrp_price,
    retail_price,
    special_retail_price,
    wholesale_price,
    r_id,
    firm_id
  ]
);

    if (!updatedStock.rows.length) {
      throw new AppError("Failed to update selling price", 400);
    }

    return updatedStock.rows[0];
  }
  async changeQty(data: StockQtyChangeBody, client: PoolClient) {
    const {
      available_qty,
      branch_id,
      note,
      r_id
    } = data
    const isStockExist = await getRecord(
      r_id,
      "stock",
      "branch_id",
      branch_id,
      client
    );

    if (!isStockExist) {
      throw new AppError("Stock not found", 404);
    }
    const changed_qty = Number(isStockExist.available_quantity) - Number(available_qty)
    if (changed_qty === 0) {
      throw new AppError("Available quantity must be changed", 400);
    }
    const flow_type = changed_qty > 0 ? "Stock payment" : "Stock receipt"
    const updatedStock = await executeInTransaction(
      client,
      `
    UPDATE stock
    SET available_quantity = $1
    WHERE id = $2
      AND branch_id = $3 
      AND status != 0
    RETURNING *;
    `,
      [available_qty, r_id, branch_id]
    );

    if (!updatedStock.rows.length) {
      throw new AppError("Failed to update Available quantity", 400);
    }
    const stockQuery = `
        INSERT INTO stock_adjustments (
          quantity,
          branch_id,
          stock_id,
          note,
          flow_type
        )
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *;
      `;

    const values = [
      Math.abs(changed_qty),
      branch_id,
      r_id,
      note,
      flow_type
    ];

    await executeInTransaction(client, stockQuery, values);
    return `${flow_type} created successfully. Quantity changed: ${Math.abs(changed_qty)}`;
  }
}