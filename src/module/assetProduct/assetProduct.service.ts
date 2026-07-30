import { executeInTransaction, query, transaction } from "../../config/db";
import { getRecord, getStatusCode } from "../../utils/extra";
import {
  CreateAssetProductParams,
  AssetProduct,
  DeleteAssetProductParams,
  EditAssetProductParams,
  FetchAssetProductParams,
  GetAssetProductReport,
  FetchAssetProductBody,
} from "./assetProduct.types";
import { AppError } from "../../utils/AppError";
import { PoolClient } from "pg";
import { buildAuditChanges } from "../journal/journal.utils";

export default class ProductService {

  async createProduct(data: CreateAssetProductParams, client: PoolClient) {
    const {
      company_id,
      brand_name,
      name,
      description,
      unit,
      cgst_rate,
      sgst_rate,
      igst_rate,
      image,
      remarks,
      status
    } = data;

    const companyExist = await getRecord(
      company_id,
      "company",
      "id",
      company_id,
      client
    );
    if (!companyExist) throw new AppError("Company not found", 404);

    const queryText = `
        INSERT INTO asset_products (
          asset_brand,
          asset_name,
          description,
          unit,
          cgst_rate,
          sgst_rate,
          igst_rate,
          status,
          remarks,
          image,
          company_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11
        )
        RETURNING *;
      `;

    const values = [
      brand_name || null,
      name,
      description || null,
      unit,
      cgst_rate ?? 0,
      sgst_rate ?? 0,
      igst_rate ?? 0,
      getStatusCode(status) || getStatusCode("Active"),
      JSON.stringify(remarks),
      image,
      company_id,
    ];

    const { rows } = await executeInTransaction(
      client,
      queryText,
      values
    );
    return rows[0];
  }

  async fetchProducts(params: FetchAssetProductParams) {
    const { filters = {} as FetchAssetProductBody } = params;

    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    // Exclude deleted (assuming status = 0 means deleted)
    queryParams.push(0);
    whereConditions.push(`ap.status != $${queryParams.length}`);

    // Search
    if (filters.search) {
      queryParams.push(`%${filters.search}%`);
      const index = queryParams.length;

      whereConditions.push(`
      (
        ap.asset_name ILIKE $${index}
        OR ap.asset_brand ILIKE $${index}
      )
    `);
    }

    // Company filter
    if (filters.company_id) {
      queryParams.push(filters.company_id);
      whereConditions.push(`ap.company_id = $${queryParams.length}`);
    }

    // Product ID filter
    if (filters.id) {
      queryParams.push(filters.id);
      whereConditions.push(`ap.id = $${queryParams.length}`);
    }

    // Status filter
    if (filters.status !== undefined) {
      queryParams.push(filters.status);
      whereConditions.push(`ap.status = $${queryParams.length}`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // ============================
    // DATA QUERY
    // ============================
    const dataQuery = `
    SELECT
      ap.*
    FROM asset_products ap
    ${whereClause}
    ORDER BY ap.id DESC
    LIMIT $${queryParams.length + 1}
    OFFSET $${queryParams.length + 2}
  `;

    // ============================
    // COUNT QUERY
    // ============================
    const countQuery = `
    SELECT COUNT(*)
    FROM asset_products ap
    ${whereClause}
  `;

    const products = await query<any>(
      dataQuery,
      [...queryParams, limit, offset]
    );

    const totalResult = await query<{ count: string }>(
      countQuery,
      queryParams
    );

    return {
      data: products,
      pagination: {
        page,
        limit,
        total: Number(totalResult[0].count),
        totalPages: Math.ceil(Number(totalResult[0].count) / limit),
      },
    };
  }


  async updateProduct(
  data: EditAssetProductParams,
  client: PoolClient
) {
  const {
    id,
    company_id,
    remarks,
    statusCode,
    ...rest
  } = data;

  const existing = await getRecord(
    id,
    "asset_products",
    "company_id",
    company_id,
    client
  );

  if (!existing) {
    throw new AppError("Asset product not found", 404);
  }

  const queryText = `
    UPDATE asset_products
    SET
      asset_brand = $1,
      asset_name = $2,
      description = $3,
      unit = $4,
      cgst_rate = $5,
      sgst_rate = $6,
      igst_rate = $7,
      status = $8,
      image = $9,
      remarks = CASE
        WHEN remarks IS NULL THEN $10::jsonb
        WHEN jsonb_typeof(remarks) = 'array'
          THEN remarks || $10::jsonb
        ELSE jsonb_build_array(remarks) || $10::jsonb
      END
    WHERE id = $11
    RETURNING *;
  `;

  const values = [
    rest.asset_brand ?? existing.asset_brand,
    rest.asset_name ?? existing.asset_name,
    rest.description ?? existing.description,
    rest.unit ?? existing.unit,
    rest.cgst_rate ?? existing.cgst_rate,
    rest.sgst_rate ?? existing.sgst_rate,
    rest.igst_rate ?? existing.igst_rate,
    statusCode ?? existing.status,
    rest.image ?? existing.image,
    JSON.stringify(remarks ?? []),
    id,
  ];

  const { rows } = await executeInTransaction(
    client,
    queryText,
    values
  );

  const changes = buildAuditChanges(existing, rows[0]);

  return {
    data: rows[0],
    changes,
  };
}

  async deleteProduct(data: DeleteAssetProductParams, client: PoolClient) {
    const { r_id, company_id, remarks } = data;

    const existing = await getRecord(
      r_id,
      "asset_products",
      "company_id",
      company_id,
      client
    );

    if (!existing)
      throw new AppError("Product not found", 404);

    const queryText = `
        UPDATE asset_products
        SET
          status = 0,
          remarks =
            CASE
              WHEN jsonb_typeof(remarks) = 'array'
                THEN remarks || $1::jsonb
              ELSE jsonb_build_array(remarks) || $1::jsonb
            END
        WHERE id = $2
        RETURNING *;
      `;

    const { rows } = await executeInTransaction(client, queryText, [
      JSON.stringify(remarks),
      r_id,
    ]);
    return rows[0]
  }
  async getProductReportSummary(data: GetAssetProductReport) {

    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;
    return transaction(async (client) => {
      let firmIds: number[] = [];

      /* ================= GET FIRM IDS ================= */

      if (level === "firm") {
        firmIds = [firm_id!];
      }

      if (level === "branch") {
        const firms = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = firms.rows.map((f: any) => f.id);
      }

      if (level === "company") {
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

      const hasDate = Boolean(start_date && end_date);

      /* ================= MAIN QUERY ================= */

      const result = await executeInTransaction(
        client,
        `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.short_name,

        /* ================= INCOME ================= */
        COALESCE(SUM(
          CASE 
            WHEN s.status = 4
            ${hasDate ? "AND s.invoice_date BETWEEN $2 AND $3" : ""}
            THEN si.net_amount
            ELSE 0
          END
        ),0)
        +
        COALESCE(SUM(
          CASE 
            WHEN pr.status = 4
            ${hasDate ? "AND pr.return_date BETWEEN $2 AND $3" : ""}
            THEN pri.net_amount
            ELSE 0
          END
        ),0)
        AS total_income,

        /* ================= EXPENSE ================= */
        COALESCE(SUM(
          CASE 
            WHEN pu.status = 4
            ${hasDate ? "AND pu.bill_date BETWEEN $2 AND $3" : ""}
            THEN pi.net_amount
            ELSE 0
          END
        ),0)
        +
        COALESCE(SUM(
          CASE 
            WHEN sr.status = 4
            ${hasDate ? "AND sr.return_date BETWEEN $2 AND $3" : ""}
            THEN sri.net_amount
            ELSE 0
          END
        ),0)
        AS total_expense,

        /* ================= NET SOLD ================= */
        COALESCE(SUM(
          CASE 
            WHEN s.status = 4
            ${hasDate ? "AND s.invoice_date BETWEEN $2 AND $3" : ""}
            THEN si.saled_qty
            ELSE 0
          END
        ),0)
        -
        COALESCE(SUM(
          CASE 
            WHEN sr.status = 4
            ${hasDate ? "AND sr.return_date BETWEEN $2 AND $3" : ""}
            THEN sri.returned_qty
            ELSE 0
          END
        ),0)
        AS net_sold_quantity

      FROM products p

      /* SALES */
      LEFT JOIN sales_items si 
        ON si.product_id = p.id
       AND si.firm_id = ANY($1)

      LEFT JOIN sales s 
        ON s.id = si.sale_id
       AND s.firm_id = ANY($1)

      /* SALES RETURNS */
      LEFT JOIN sale_return_items sri 
        ON sri.product_id = p.id
       AND sri.firm_id = ANY($1)

      LEFT JOIN sale_return sr 
        ON sr.id = sri.sale_return_id
       AND sr.firm_id = ANY($1)

      /* PURCHASES */
      LEFT JOIN purchase_items pi 
        ON pi.product_id = p.id
       AND pi.firm_id = ANY($1)

      LEFT JOIN purchases pu 
        ON pu.id = pi.purchase_id
       AND pu.firm_id = ANY($1)

      /* PURCHASE RETURNS */
      LEFT JOIN purchase_return_items pri 
        ON pri.product_id = p.id
       AND pri.firm_id = ANY($1)

      LEFT JOIN purchase_return pr 
        ON pr.id = pri.purchase_return_id
       AND pr.firm_id = ANY($1)

      WHERE p.status = 1

      GROUP BY p.id

      HAVING 
        COALESCE(SUM(si.saled_qty),0) != 0 OR
        COALESCE(SUM(pi.purchased_qty),0) != 0
      `,
        hasDate
          ? [firmIds, start_date, end_date]
          : [firmIds]
      );

      const products = result.rows;

      /* ================= SUMMARY ================= */

      let mostSold = null;
      let leastSold = null;

      if (products.length) {
        mostSold = products.reduce((a: any, b: any) =>
          Number(b.net_sold_quantity) > Number(a.net_sold_quantity) ? b : a
        );

        leastSold = products.reduce((a: any, b: any) =>
          Number(b.net_sold_quantity) < Number(a.net_sold_quantity) ? b : a
        );
      }

      return {
        total_products_with_activity: products.length,

        summary: {
          total_income: products.reduce((s, p) => s + Number(p.total_income), 0),
          total_expense: products.reduce((s, p) => s + Number(p.total_expense), 0),
          net_result: products.reduce(
            (s, p) => s + (Number(p.total_income) - Number(p.total_expense)),
            0
          ),
        },

        most_sold_product: mostSold || null,
        least_sold_product: leastSold || null,

        products
      };
    });
  }
}