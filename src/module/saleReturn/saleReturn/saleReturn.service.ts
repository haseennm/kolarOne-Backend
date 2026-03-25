import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { isExist } from "../../../utils/extra";
import { SaleReturnCreateParams, SaleReturnDeleteParams, SaleReturnFetchParams } from "./saleReturn.types";

export default class SaleReturnService {

  async createSaleReturn(data: SaleReturnCreateParams, client: PoolClient) {
    const {
      sale_id,
      return_date,
      reason,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      final_amount,
      payment_method_id,
      firm_id,
      statusCode,
      transaction_reference,
      branch_id,
      company_id,
      remark,
    } = data;

    // Check firm existence
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
    const is_sale_exist = await isExist(
      sale_id,
      "sales",
      "firm_id",
      firm_id,
      client
    );

    if (!is_sale_exist) {
      throw new AppError("Sale not found", 404);
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

    const result = await executeInTransaction(
      client,
      `
  SELECT return_number
  FROM sale_return
  WHERE firm_id = ?
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE
  `,
      [firm_id]
    );

    let return_number;

    if (!result.rows.length) {
      return_number = `SLRTN-${firm_id}-0001`;
    } else {
      const lastReturn = result.rows[0];

      const lastNumber = parseInt(
        lastReturn.return_number.split("-")[2],
        10
      );

      const newNumber = lastNumber + 1;

      return_number = `SLRTN-${firm_id}-${String(newNumber).padStart(4, "0")}`;
    }
    const query = `
  INSERT INTO sale_return
  (
    sale_id,
    return_number,
    return_date,
    reason,
    sub_total,
    total_cgst,
    total_sgst,
    total_igst,
    status,
    remarks,
    firm_id,
    final_amount,
    payment_method_id,
    reference_number
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
  )
  RETURNING *;
`;

    const values = [
      sale_id,
      return_number,
      return_date,
      reason || null,
      subtotal ?? 0,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      statusCode,
      JSON.stringify(remark),
      firm_id,
      final_amount,
      payment_method_id ?? null,
      transaction_reference ?? null
    ];

    const { rows } = await executeInTransaction(client, query, values);
    return rows[0];
  }
//   async editPurchase(data: PurchaseEditParams, client: PoolClient) {
//     const {
//       bill_date,
//       bill_number,
//       discount,
//       final_amount,
//       firm_id,
//       net_amount,
//       payment_amount,
//       payment_method_id,
//       remark,
//       statusCode,
//       subtotal,
//       total_cgst,
//       total_igst,
//       total_sgst,
//       vendor_id,
//       notes,
//       transaction_reference,
//       branch_id,
//       company_id,
//       purchase_id
//     } = data;

//     // Check firm existence
//     const is_purchase_exist = await isExist(
//       purchase_id,
//       "purchases",
//       "firm_id",
//       firm_id,
//       client
//     );

//     if (!is_purchase_exist) {
//       throw new AppError("Firm not found", 404);
//     }
//     if (payment_method_id && payment_method_id !== is_purchase_exist.payment_method_id) {
//       const is_payment_method_exist = await isExist(
//         payment_method_id,
//         "payment_methods",
//         "company_id",
//         company_id,
//         client
//       );

//       if (!is_payment_method_exist) {
//         throw new AppError("payment method not found", 404);
//       }
//     }
//     if (vendor_id && vendor_id !== is_purchase_exist.vendor_id) {
//       const is_vendor_exist = await isExist(
//         vendor_id,
//         "vendors",
//         "company_id",
//         company_id,
//         client
//       );

//       if (!is_vendor_exist) {
//         throw new AppError("Vendor not found", 404);
//       }
//     }
//     if (bill_number && bill_number !== is_purchase_exist.bill_number) {

//       const is_bill_exist = await executeInTransaction(
//         client,
//         `SELECT id FROM purchases 
//    WHERE bill_number = $1 
//    AND vendor_id = $2 
//    AND status != 0`,
//         [bill_number, vendor_id]
//       );

//       if ((is_bill_exist.rowCount ?? 0) > 0) {
//         throw new AppError("purchase bill already exist", 400);
//       }
//     }
//     const purchaseQuery = `
//   UPDATE purchases SET
//     vendor_id = $1,
//     bill_number = $2,
//     bill_date = $3,
//     subtotal = $4,
//     discount = $5,
//     net_amount = $6,
//     total_cgst = $7,
//     total_sgst = $8,
//     total_igst = $9,
//     final_amount = $10,
//     payment_amount = $11,
//     notes = $12,
//     status = $13,
//     remarks = COALESCE(remarks, '[]'::jsonb) || $14::jsonb,
//     payment_method_id = $15,
//     transaction_reference = $16 WHERE
//     firm_id = $17
//    id = $18
//   RETURNING *;
// `;

//     const values = [
//       vendor_id,
//       bill_number,
//       bill_date,
//       subtotal ?? is_purchase_exist.sub_total,
//       discount ?? is_purchase_exist.discount,
//       net_amount ?? is_purchase_exist.net_amount,
//       total_cgst ?? is_purchase_exist.total_cgst,
//       total_sgst ?? is_purchase_exist.total_sgst,
//       total_igst ?? is_purchase_exist.total_igst,
//       final_amount ?? is_purchase_exist.final_amount,
//       payment_amount ?? is_purchase_exist.payment_amount,
//       notes ?? is_purchase_exist.notes,
//       statusCode,
//       JSON.stringify([remark]),

//       payment_method_id ?? is_purchase_exist.payment_method_id,
//       transaction_reference ?? is_purchase_exist.transaction_reference,
//       firm_id,
//       purchase_id
//     ];

//     const { rows } = await executeInTransaction(client, purchaseQuery, values);
//     return rows[0];
//   }

async fetchSaleReturn(data: SaleReturnFetchParams) {
  const { filters, offset } = data;

  let where: string[] = [];
  let values: any[] = [];

  // status filter
  where.push(`sr.status != $${values.length + 1}`);
  values.push(0);

  if (filters?.id) {
    values.push(filters.id);
    where.push(`sr.id = $${values.length}`);
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
    where.push(`sr.firm_id = $${values.length}`);
  }

  if (filters?.start_date) {
    values.push(filters.start_date);
    where.push(`sr.return_date >= $${values.length}`);
  }

  if (filters?.end_date) {
    values.push(filters.end_date);
    where.push(`sr.return_date <= $${values.length}`);
  }

  if (filters?.search) {
    values.push(`%${filters.search}%`);
    where.push(`(
      sr.return_number ILIKE $${values.length}
      OR s.invoice_number ILIKE $${values.length}
      OR c.customer_name ILIKE $${values.length}
    )`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // 🔥 MAIN QUERY
  const sale_returnQuery = `
    SELECT 
      sr.*,
      s.invoice_number,
      c.customer_name,
      f.branch_id,
      b.company_id
    FROM sale_return sr
    LEFT JOIN sales s ON s.id = sr.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN firm f ON f.id = sr.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
    ORDER BY sr.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

  // 🔥 COUNT QUERY
  const countQuery = `
    SELECT COUNT(*)
    FROM sale_return sr
    LEFT JOIN sales s ON s.id = sr.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN firm f ON f.id = sr.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

  const sale_returns = await query(
    sale_returnQuery,
    [...values, filters.limit, offset]
  );

  const total = await query<{ count: string }>(countQuery, values);

  return {
    sale_returns,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: Number(total[0].count),
      totalPages: Math.ceil(Number(total[0].count) / filters.limit),
    },
  };
}
 async fetchSaleReturnFull(data: SaleReturnFetchParams) {
  const { filters, offset } = data;

  let where: string[] = [];
  let values: any[] = [];

  // status filter
  where.push(`sr.status != $${values.length + 1}`);
  values.push(0);

  if (filters?.id) {
    values.push(filters.id);
    where.push(`sr.id = $${values.length}`);
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
    where.push(`sr.firm_id = $${values.length}`);
  }

  if (filters?.start_date) {
    values.push(filters.start_date);
    where.push(`sr.return_date >= $${values.length}`);
  }

  if (filters?.end_date) {
    values.push(filters.end_date);
    where.push(`sr.return_date <= $${values.length}`);
  }

  if (filters?.search) {
    values.push(`%${filters.search}%`);
    where.push(`(
      sr.return_number ILIKE $${values.length}
      OR s.invoice_number ILIKE $${values.length}
      OR c.customer_name ILIKE $${values.length}
    )`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // 🔥 MAIN QUERY
  const saleReturnQuery = `
    SELECT 
      sr.*,
      s.invoice_number,
      c.customer_name,
      pm.method_name AS payment_method,
      f.branch_id,
      b.company_id,

      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', sri.id,
            'product_id', sri.product_id,
            'product_name', prd.name,
            'stock_id', sri.stock_id,
            'batch_number', st.batch_number,
            'returned_qty', sri.returned_qty,
            'unit', sri.unit,
            'unit_price', sri.unit_price,
            'sub_total', sri.sub_total,
            'total_cgst', sri.total_cgst,
            'total_sgst', sri.total_sgst,
            'total_igst', sri.total_igst,
            'net_amount', sri.net_amount,
            'status', sri.status
          )
        ) FILTER (WHERE sri.id IS NOT NULL),
        '[]'
      ) AS items

    FROM sale_return sr

    LEFT JOIN sales s ON s.id = sr.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN payment_methods pm ON pm.id = sr.payment_method_id

    LEFT JOIN firm f ON f.id = sr.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id

    LEFT JOIN sale_return_items sri ON sri.sale_return_id = sr.id
    LEFT JOIN products prd ON prd.id = sri.product_id
    LEFT JOIN stock st ON st.id = sri.stock_id

    ${whereClause}

    GROUP BY 
      sr.id,
      s.invoice_number,
      c.customer_name,
      pm.method_name,
      f.branch_id,
      b.company_id

    ORDER BY sr.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

  // 🔥 COUNT QUERY
  const countQuery = `
    SELECT COUNT(*)
    FROM sale_return sr
    LEFT JOIN sales s ON s.id = sr.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN firm f ON f.id = sr.firm_id
    LEFT JOIN branches b ON b.id = f.branch_id
    ${whereClause}
  `;

  const saleReturns = await query(
    saleReturnQuery,
    [...values, filters.limit, offset]
  );

  const total = await query<{ count: string }>(countQuery, values);

  return {
    saleReturns,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: Number(total[0].count),
      totalPages: Math.ceil(Number(total[0].count) / filters.limit),
    },
  };
}
 async deleteSaleReturn(
  data: SaleReturnDeleteParams,
  client: PoolClient
) {
  const { id, remark, firm_id } = data;

  // ✅ Check existence
  const isExistPR = await isExist(
    id,
    "sale_return",
    "firm_id",
    firm_id,
    client
  );

  if (!isExistPR) {
    throw new AppError("sale return not found or already deleted", 404);
  }

  // ✅ Soft delete فقط
  const queryText = `
    UPDATE sale_return pr
    SET
      status = $1,
      remarks =
        CASE
          WHEN jsonb_typeof(pr.remarks) = 'array'
            THEN pr.remarks || $2::jsonb
          ELSE jsonb_build_array(pr.remarks) || $2::jsonb
        END
    FROM firm f
    JOIN branches b ON f.branch_id = b.id
    WHERE 
      pr.id = $3 
      AND pr.firm_id = $4
      AND pr.firm_id = f.id
    RETURNING pr.id, b.company_id;
  `;

  const values = [
    0, // deleted status
    JSON.stringify(remark),
    id,
    firm_id
  ];

  const result = await executeInTransaction(client, queryText, values);

  return result.rows[0]; // { id, company_id }
}
  // async canDeletePurchase(data: PurchaseDeleteParams, client: PoolClient) {
  //   const { id, firm_id } = data;
  //   const isPurchaseExist = await isExist(
  //     id,
  //     "purchases",
  //     "firm_id",
  //     firm_id,
  //     client
  //   );

  //   if (!isPurchaseExist) {
  //     throw new AppError("Purchase not found or already deleted", 404);
  //   }



  //   const queryText = `
  //       UPDATE purchases
  //       SET
  //         status = $1,
  //         remarks =
  //           CASE
  //             WHEN jsonb_typeof(remarks) = 'array'
  //               THEN remarks || $2::jsonb
  //             ELSE jsonb_build_array(remarks) || $2::jsonb
  //           END
  //       WHERE id = $3 AND firm_id =$4
  //       RETURNING *;
  //       `;

  //   const values = [
  //     0,
  //     JSON.stringify(remark),
  //     id, firm_id
  //   ];

  //   const row = await executeInTransaction(client, queryText, values);

  //   return row.rows[0];
  // }
}