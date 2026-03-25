import { getRecord } from "../../../utils/extra";
import { executeInTransaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { PoolClient } from "pg";
import { CreateSaleReturnItemParams, DeleteSaleReturnItemParams, FetchDbSaleReturnItem, FetchSaleReturnItemParams, SaleReturnItemCountResult } from "./saleReturnItems.types";

export default class SaleReturnItemService {

  async createSaleReturnItems(data: CreateSaleReturnItemParams, client: PoolClient) {

    const {
      firm_id,
      sale_return_id,
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
      statusCode,
      returned_qty,
      sale_item_id,
      return_mode
    } = data;

    const check_exist_return = await getRecord(
      sale_return_id, "sale_return", "firm_id", firm_id, client
    )
    if (!check_exist_return) throw new AppError("Sale return not found.", 404)
    if (stock_id) {
      const check_exist_stock = await getRecord(
        stock_id, "stock", "firm_id", firm_id, client
      )
      if (!check_exist_stock) throw new AppError("Stock not found.", 404)
    }
  const saleItem = await getRecord(
  sale_item_id,
  "sales_items",
  "firm_id",
  firm_id,
  client
);

if (!saleItem) {
  throw new AppError("Sale item not found.", 404);
}

const sold_qty = Number(saleItem.saled_qty ?? saleItem.quantity);
const returnedQtyQuery = `
  SELECT COALESCE(SUM(returned_qty), 0) AS total_returned
  FROM sale_return_items
  WHERE sale_item_id = $1 AND firm_id = $2 AND status = $3
`;

const { rows: returnedRows } = await client.query(returnedQtyQuery, [
  sale_item_id,
  firm_id,
  0
]);

const already_returned = Number(returnedRows[0].total_returned);
if (returned_qty + already_returned > sold_qty) {
  throw new AppError(
    `Return exceeds sold quantity. Max allowed: ${sold_qty - already_returned}`,
    400
  );
}
    const saleReturnItemQuery = `
    INSERT INTO sale_return_items (
      firm_id,
      sale_return_id,
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
      sale_item_id,
      return_mode
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, $16
    )
    RETURNING *;
  `;

    const values = [
      firm_id,
      sale_return_id,
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
      sale_item_id,
      return_mode
    ];
console.log("first")
const { rows } = await executeInTransaction(client, saleReturnItemQuery, values);
console.log("second")

    return rows[0];
  }

//   async fetchPurchaseReturnItems(data: FetchSaleReturnItemParams) {

//     const { filters, offset } = data;

//     let where: string[] = [];
//     let values: any[] = [];

//     // ignore deleted
//     where.push(`status != $${values.length + 1}`);
//     values.push(0);

//     if (filters?.id) {
//       values.push(filters.id);
//       where.push(`id = $${values.length}`);
//     }

//     if (filters?.purchase_id) {
//       values.push(filters.purchase_id);
//       where.push(`purchase_id = $${values.length}`);
//     }

//     if (filters?.firm_id) {
//       values.push(filters.firm_id);
//       where.push(`firm_id = $${values.length}`);
//     }

//     if (filters?.branch_id) {
//       values.push(filters.branch_id);
//       where.push(`branch_id = $${values.length}`);
//     }

//     const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

//     const saleItemQuery = `
//   SELECT 
//     pi.*,
//     p.name AS product_name,
//     pu.bill_number,
//     s.batch_number
//   FROM sale_return_items pi
//   LEFT JOIN products p ON p.id = pi.product_id
//   LEFT JOIN purchases pu ON pu.id = pi.purchase_id
//   LEFT JOIN stock s ON s.id = pi.stock_id
//   ${whereClause}
//   ORDER BY pi.id DESC
//   LIMIT $${values.length + 1}
//   OFFSET $${values.length + 2}
// `;

//     const countQuery = `
//     SELECT COUNT(*)
//     FROM sale_return_items
//     ${whereClause}
//   `;

//     const items = await query<FetchDbSaleReturnItem>(
//       SaleItemQuery,
//       [...values, filters.limit, offset]
//     );

//     const total = await query<SaleReturnItemCountResult>(countQuery, values);

//     return {
//       items,
//       pagination: {
//         page: filters.page,
//         limit: filters.limit,
//         total: Number(total[0].count),
//         totalPages: Math.ceil(Number(total[0].count) / filters.limit),
//       },
//     };
//   }

  // async updatePurchaseItem(data: EditPurchaseItemParams, client: PoolClient) {
  //   const {

  //     branch_id,
  //     firm_id,
  //     purchased_qty,
  //     received_qty,
  //     unit,
  //     unit_price,
  //     sub_total,
  //     total_cgst,
  //     total_sgst,
  //     total_igst,
  //     net_amount,
  //     stock_id,
  //     item_id, purchase_id, remark, statusCode, product_id
  //   } = data;

  //   // 1. Validate firm existence (requirement)
  //   const is_item_exist = await getRecord(
  //     item_id,
  //     "sale_return_items",
  //     "branch_id",
  //     branch_id,
  //     client
  //   );
  //   if (!is_item_exist) {
  //     throw new AppError("Purchase item not found", 404);
  //   }
  //   const final_received_qty = received_qty ?? is_item_exist.received_qty;
  //   const final_purchased_qty = purchased_qty ?? is_item_exist.purchased_qty;
  //   if (final_received_qty > final_purchased_qty) {
  //     throw new AppError(
  //       "Received quantity cannot exceed purchased quantity",
  //       422
  //     );
  //   }
  //   const updateQuery = `
  //     UPDATE sale_return_items
  //   SET
  //   purchased_qty = $1,
  //     received_qty = $2,
  //     unit = $3,
  //     unit_price = $4,
  //     sub_total = $5,
  //     total_cgst = $6,
  //     total_sgst = $7,
  //     total_igst = $8,
  //     net_amount = $9,
  //     stock_id = $10,
  //     remarks =
  //     CASE
  //         WHEN remarks IS NULL THEN $11:: jsonb
  //         WHEN jsonb_typeof(remarks) = 'array'
  //           THEN remarks || $11:: jsonb
  //         ELSE jsonb_build_array(remarks) || $11:: jsonb
  //   END
  //     WHERE id = $12 AND firm_id =$13
  //   RETURNING *;
  //   `;

  //   const values = [
  //     purchased_qty ?? is_item_exist.purchased_qty,
  //     received_qty ?? is_item_exist.received_qty,
  //     unit ?? is_item_exist.unit,
  //     unit_price ?? is_item_exist.unit_price,
  //     sub_total ?? is_item_exist.sub_total,
  //     total_cgst ?? is_item_exist.total_cgst,
  //     total_sgst ?? is_item_exist.total_sgst,
  //     total_igst ?? is_item_exist.total_igst,
  //     net_amount ?? is_item_exist.net_amount,
  //     stock_id ?? is_item_exist.stock_id,
  //     JSON.stringify(remark),
  //     item_id,
  //     firm_id
  //   ];

  //   const { rows } = await executeInTransaction(client, updateQuery, values);
  //   return rows[0];
  // }

  async deleteSaleReturnItem(data: DeleteSaleReturnItemParams, client: PoolClient) {
    const { sale_return_id, firm_id, remark } = data;
    const isItemExist = await executeInTransaction(client,
      `SELECT * FROM sale_return_items WHERE sale_return_id =$1 AND firm_id= $2`,
      [sale_return_id, firm_id]
    )
    if (isItemExist) {
      throw new AppError("Sale item not found for this Sale", 404)
    }

    const deleteQuery = `
        UPDATE sale_return_items
        SET status = 0
        WHERE sale_return_id = $1 AND firm_id = $2
    RETURNING *;
    `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [sale_return_id, firm_id]
    );

    return rows[0];
  }
}