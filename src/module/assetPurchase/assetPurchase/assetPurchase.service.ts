import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { billStatus, getRecord, getStatusCode } from "../../../utils/extra";
import { AssetPurchaseCreateParams, AssetPurchaseDeleteParams, AssetPurchaseEditParams, AssetPurchaseFetchParams, RepayBalanceAssetPurchase } from "./assetPurchase.types";
import { buildAuditChanges } from "../../journal/journal.utils";

export default class AssetPurchaseService {


  async createAssetPurchase(data: AssetPurchaseCreateParams, client: PoolClient) {
    const {
      bill_date,
      bill_number,
      discount,
      final_amount,
      firm_id,
      net_amount,
      paid_amount, // Renamed tracking column parameter
      payments,    // Holds the raw stringified payments JSON array
      remark,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      vendor_id,
      notes,
      branch_id,
      company_id,
      courier_charge,
      handling_charge,
      other_charge
    } = data;

    if (firm_id && branch_id) {
      const is_firm_exist = await getRecord(
        firm_id,
        "firm",
        "branch_id",
        branch_id,
        client
      );
      if (!is_firm_exist) {
        throw new AppError("Firm not found", 404);
      }
    }
    if (!firm_id && branch_id) {
      const is_branch_exist = await getRecord(
        branch_id,
        "branches",
        "company_id",
        company_id,
        client
      );
      if (!is_branch_exist) {
        throw new AppError("Branch not found", 404);
      }
    }
    const is_vendor_exist = await getRecord(
      vendor_id,
      "vendors",
      "company_id",
      company_id,
      client
    );

    if (!is_vendor_exist) {
      throw new AppError("Vendor not found", 404);
    }

    const is_bill_exist = await executeInTransaction(
      client,
      `SELECT id FROM asset_purchases 
     WHERE bill_number = $1 
     AND vendor_id = $2 
     AND status != 0`,
      [bill_number, vendor_id]
    );

    if ((is_bill_exist.rowCount ?? 0) > 0) {
      throw new AppError("purchase bill already exist", 400);
    }

    const refResult = await executeInTransaction(
      client,
      `SELECT CONCAT('PB-', nextval('sale_ref_seq')) AS ref`
    );

    const ref_no = refResult.rows[0].ref;

    // The database schema columns updated to reflect your new design requirements
    const purchaseQuery = `
    INSERT INTO aseet_purchases (
      vendor_id,
      bill_number,
      bill_date,
      subtotal,
      discount,
      net_amount,
      total_cgst,
      total_sgst,
      total_igst,
      final_amount,
      paid_amount,
      notes,
      status,
      remarks,
      firm_id,
      ref_no,
      courier_charge,
      handling_charge,
      other_charge
      branch_id,
      company_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
    )
    RETURNING *;
  `;

    const values = [
      vendor_id,
      bill_number,
      bill_date,
      subtotal ?? 0,
      discount ?? 0,
      net_amount ?? 0,
      total_cgst ?? 0,
      total_sgst ?? 0,
      total_igst ?? 0,
      final_amount ?? 0,
      paid_amount ?? 0,
      notes ?? null,
      billStatus(final_amount ?? 0, paid_amount ?? 0),
      JSON.stringify(remark) ?? {},
      firm_id,
      ref_no,
      courier_charge ?? 0,
      handling_charge ?? 0,
      other_charge ?? 0,
      branch_id || null,
      company_id
    ];

    const { rows } = await executeInTransaction(client, purchaseQuery, values);
    return rows[0];
  }
  async editAssetPurchase(data: AssetPurchaseEditParams, client: PoolClient) {
    const {
      bill_date,
      bill_number,
      discount,
      final_amount,
      firm_id,
      branch_id,
      company_id,
      net_amount,
      subtotal,
      total_cgst,
      total_igst,
      total_sgst,
      vendor_id,
      notes,
      asset_purchase_id,
      courier_charge,
      handling_charge,
      other_charge,
      remark,
      computed_payment_amount,
      merged_payments_json
    } = data;

    const conditions = ["id = $1"];
    const check_values = [asset_purchase_id];
    let index = 2;

    if (company_id) {
      conditions.push(`company_id = $${index++}`);
      check_values.push(company_id);
    }

    if (branch_id) {
      conditions.push(`branch_id = $${index++}`);
      check_values.push(branch_id);
    }

    if (firm_id) {
      conditions.push(`firm_id = $${index++}`);
      check_values.push(firm_id);
    }

    const queryExisting = await executeInTransaction(
      client,
      `
      SELECT *
      FROM asset_purchases
      WHERE ${conditions.join(" AND ")}
      FOR UPDATE;
      `,
      check_values
    );

    const is_purchase_exist = queryExisting.rows[0];

    if (!is_purchase_exist) {
      throw new AppError("Purchase not found", 404);
    }

    // 2. Validate Vendor Entity Link
    if (vendor_id && vendor_id !== is_purchase_exist.vendor_id) {
      const is_vendor_exist = await getRecord(vendor_id, "vendors", "company_id", company_id, client);
      if (!is_vendor_exist) {
        throw new AppError("Vendor not found", 404);
      }
    }

    if (bill_number && bill_number !== is_purchase_exist.bill_number) {
      const activeVendor = vendor_id ?? is_purchase_exist.vendor_id;
      const is_bill_exist = await executeInTransaction(
        client,
        `SELECT id FROM asset_purchases WHERE bill_number = $1 AND vendor_id = $2 AND status != 0 AND id != $3`,
        [bill_number, activeVendor, asset_purchase_id]
      );
      if ((is_bill_exist.rowCount ?? 0) > 0) {
        throw new AppError("purchase bill already exist", 400);
      }
    }


    const purchaseQuery = `
  UPDATE asset_purchases SET
    vendor_id = $1,
    bill_number = $2,
    bill_date = $3,
    subtotal = $4,
    discount = $5,
    net_amount = $6,
    total_cgst = $7,
    total_sgst = $8,
    total_igst = $9,
    final_amount = $10,
    paid_amount = $11, -- ✅ Check this name aligns precisely with schema definition definitions
    notes = $12,
    status = $13,
    remarks = CASE
      WHEN remarks IS NULL THEN $14::jsonb
      WHEN jsonb_typeof(remarks) = 'array' THEN remarks || $14::jsonb
      ELSE jsonb_build_array(remarks) || $14::jsonb
    END,
    courier_charge = $15,
    handling_charge = $16,
    other_charge = $17 
  WHERE company_id = $18 AND id = $19
  RETURNING *;
`;
    const targetFinalAmount = final_amount ?? is_purchase_exist.final_amount;
    const values = [
      vendor_id ?? is_purchase_exist.vendor_id,
      bill_number ?? is_purchase_exist.bill_number,
      bill_date ?? is_purchase_exist.bill_date,
      subtotal ?? is_purchase_exist.subtotal,
      discount ?? is_purchase_exist.discount,
      net_amount ?? is_purchase_exist.net_amount,
      total_cgst ?? is_purchase_exist.total_cgst,
      total_sgst ?? is_purchase_exist.total_sgst,
      total_igst ?? is_purchase_exist.total_igst,
      targetFinalAmount,
      computed_payment_amount,
      notes ?? is_purchase_exist.notes,
      billStatus(Number(targetFinalAmount), computed_payment_amount),
      JSON.stringify([remark]),
      courier_charge ?? is_purchase_exist.courier_charge,
      handling_charge ?? is_purchase_exist.handling_charge,
      other_charge ?? is_purchase_exist.other_charge,
      company_id,
      asset_purchase_id
    ];

    const { rows } = await executeInTransaction(client, purchaseQuery, values);
    const changes = buildAuditChanges(is_purchase_exist, rows[0]);
    return { data: rows[0], changes };
  }
  async fetchAssetPurchase(data: AssetPurchaseFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`ap.status != $${values.length + 1}`);
    values.push(0);
    if (filters?.id) {
      values.push(filters.id);
      where.push(`ap.id = $${values.length}`);
    }

    if (filters?.company_id) {
      values.push(filters.company_id);
      where.push(`ap.company_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`ap.branch_id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`ap.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`ap.bill_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`ap.bill_date <= $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      ap.bill_number ILIKE $${values.length}
      OR v.vendor_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseQuery = `
  SELECT 
    ap.*,
    v.vendor_name,
    f.firm_name,
    b.branch_name
  FROM asset_purchases ap
  LEFT JOIN vendors v ON v.id = ap.vendor_id
  LEFT JOIN firm f ON f.id = ap.firm_id
  LEFT JOIN branches b ON b.id = ap.branch_id
  ${whereClause}
  ORDER BY ap.id DESC
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
  SELECT COUNT(*)
  FROM asset_purchases ap
  LEFT JOIN vendors v ON v.id = ap.vendor_id
  LEFT JOIN firm f ON f.id = ap.firm_id
  LEFT JOIN branches b ON b.id = ap.branch_id
  ${whereClause}
`;

    const purchases = await query(
      purchaseQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      purchases,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async fetchAssetPurchaseFull(data: AssetPurchaseFetchParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`ap.status != $${values.length + 1}`);
    values.push(0);
    if (filters?.id) {
      values.push(filters.id);
      where.push(`ap.id = $${values.length}`);
    }

    if (filters?.company_id) {
      values.push(filters.company_id);
      where.push(`ap.company_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`ap.branch_id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`ap.firm_id = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`ap.bill_date >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`ap.bill_date <= $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search}%`);
      where.push(`(
      ap.bill_number ILIKE $${values.length}
      OR v.vendor_name ILIKE $${values.length}
    )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const purchaseQuery = `
SELECT
    ap.*,
    v.vendor_name,
    f.firm_name,
    b.branch_name,

    (
        SELECT COALESCE(
            JSON_AGG(
             JSON_BUILD_OBJECT(
    'id', api.id,
    'product_id', api.product_id,
    'product_name', pr.name,
    'stock_id', api.stock_id,
    'batch_number', s.batch_number,
    'received_qty', api.received_qty,
    'purchased_qty', api.purchased_qty,
    'unit', api.unit,
    'unit_price', api.unit_price,
    'sub_total', api.sub_total,
    'total_cgst', api.total_cgst,
    'total_sgst', api.total_sgst,
    'total_igst', api.total_igst,
    'net_amount', api.net_amount,
    'min_available_count', COALESCE(s.purchased_qty - s.available_quantity, 0),
    'status', api.status
)
                ORDER BY api.id
            ),
            '[]'
        )
        FROM purchase_items api
        LEFT JOIN products pr ON pr.id = api.product_id
        LEFT JOIN asset_stock s ON s.id = api.stock_id
        WHERE api.purchase_id = ap.id
    ) AS items,

    (
    SELECT COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', pt.id,
                'payment_method_id', pt.payment_method_id,
                'payment_method', pm2.method_name,
                'amount', pt.amount,
                'payment_flow', pt.payment_flow,
                'transaction_date', pt.created_at,
                'transaction_reference', pt.transaction_reference
            )
            ORDER BY pt.id
        ),
        '[]'
    )
    FROM payment_transactions pt
    LEFT JOIN payment_methods pm2
        ON pm2.id = pt.payment_method_id
    WHERE pt.ref_id = ap.id
      AND pt.ref_type = 'APS'
      AND pt.status != 0
) AS payments

FROM asset_purchases ap
LEFT JOIN vendors v
    ON v.id = ap.vendor_id
LEFT JOIN firm f
    ON f.id = ap.firm_id
LEFT JOIN branches b
    ON b.id = ap.branch_id

${whereClause}

ORDER BY ap.id DESC
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
`;

    const countQuery = `
  SELECT COUNT(*)
  FROM asset_purchases ap
  LEFT JOIN vendors v ON v.id = ap.vendor_id
  LEFT JOIN firm f ON f.id = ap.firm_id
  LEFT JOIN branches b ON b.id = ap.branch_id
  ${whereClause}
`;

    const purchases = await query(
      purchaseQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);

    return {
      purchases,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }
  async deleteAssetPurchase(data: AssetPurchaseDeleteParams, client: PoolClient) {
    const { id, remark, firm_id, company_id, branch_id } = data;

    const conditions = ["id = $1"];
    const condition_value = [id];
    let index = 2;

    if (company_id) {
      conditions.push(`company_id = $${index++}`);
      condition_value.push(company_id);
    }

    if (branch_id) {
      conditions.push(`branch_id = $${index++}`);
      condition_value.push(branch_id);
    }

    if (firm_id) {
      conditions.push(`firm_id = $${index++}`);
      condition_value.push(firm_id);
    }

    const queryExisting = await executeInTransaction(
      client,
      `
  SELECT *
  FROM asset_purchases
  WHERE ${conditions.join(" AND ")}
  FOR UPDATE;
  `,
      condition_value
    );

    const purchase = queryExisting.rows[0];

    if (!purchase) {
      throw new AppError("Purchase not found", 404);
    }

    await this.canDeletePurchase(data, client);

    const queryText = `
    UPDATE asset_purchases
    SET
      status = $1,
      remarks =
        CASE
          WHEN p.remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(p.remarks) = 'array'
            THEN p.remarks || $2::jsonb
          ELSE jsonb_build_array(p.remarks) || $2::jsonb
        END
    WHERE 
      ap.id = $3 AND company_id =$4
    RETURNING ap.*;
  `;

    const values = [
      0,
      JSON.stringify([remark]),
      id,
      firm_id,
      company_id
    ];

    const row = await executeInTransaction(client, queryText, values);

    return row.rows[0];
  }
  async canDeletePurchase(data: AssetPurchaseDeleteParams, client: PoolClient) {
    const { id, company_id } = data;

    const purchaseReturn = await executeInTransaction(
      client,
      `SELECT 1 
     FROM asset_purchase_return 
     WHERE asset_purchase_id = $1 
       AND status != $2 
       AND company_id = $3`,
      [id, getStatusCode("Deleted"), company_id]
    );

    if (purchaseReturn.rows.length > 0) {
      throw new AppError(
        "Asset purchase return already exists, cannot delete",
        400
      );
    }
    return true;
  }
  async updateAssetPurchasePaymentAmount(data: RepayBalanceAssetPurchase, client: PoolClient) {
    const { payments, asset_purchase_id, remark, company_id, payment_flow } = data;
    // 1. Fetch record first to check existence
    const is_purchase_exist = await getRecord(
      asset_purchase_id,
      "asset_purchases",
      "company_id",
      company_id,
      client
    );

    if (!is_purchase_exist) {
      throw new AppError("Purchase not found", 404);
    }

 
    // Calculate aggregated total payment added
    const incomingTotal = payments.reduce((sum, p) => sum + p.payment_amount, 0);
    const paymentObj = payments.map((p) => ({
      payment_amount: p.payment_amount,
      payment_method_id: p.payment_method_id,
      transaction_reference: p.transaction_reference ?? ""
    }));
    const query = `
UPDATE purchases
SET
  paid_amount = CASE
    WHEN $2 = 'inc' THEN paid_amount - $1
    WHEN $2 = 'exp' THEN paid_amount + $1
    ELSE paid_amount
  END,
  remarks = CASE
    WHEN remarks IS NULL THEN $3::jsonb
    WHEN jsonb_typeof(remarks) = 'array' THEN remarks || $3::jsonb
    ELSE jsonb_build_array(remarks) || $3::jsonb
  END
WHERE id = $4
  AND company_id = $5
RETURNING *;
`;

    const values = [
      incomingTotal,              // $1
      payment_flow,               // $2
      JSON.stringify(remark),     // $4
      asset_purchase_id,                // $5
      company_id                     // $6
    ];

    const { rows } = await executeInTransaction(client, query, values);
    const changes = buildAuditChanges(is_purchase_exist, rows[0]);
    return { data: rows[0], changes, table_name: "purchases" };

  }
}
