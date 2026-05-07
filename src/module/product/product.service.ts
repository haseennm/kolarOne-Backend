import { executeInTransaction, query, transaction } from "../../config/db";
import { getRecord } from "../../utils/extra";
import {
  CountResult,
  CreateProductParams,
  Product,
  DeleteProductParams,
  EditProductParams,
  FetchProductParams,
  GetProductReport,
} from "./product.types";
import { AppError } from "../../utils/AppError";

export default class ProductService {

  async createProduct(data: CreateProductParams) {
    const {
      company_id,
      category_id,
      brand_id,
      name,
      short_name,
      description,
      sku,
      barcode,
      hsn_sac_code,
      unit,
      cgst_rate,
      sgst_rate,
      igst_rate,
      image,
      remarks,
      statusCode
    } = data;

    return transaction(async (client) => {

      const companyExist = await getRecord(
        company_id,
        "company",
        "id",
        company_id,
        client
      );
      if (!companyExist) throw new AppError("Company not found", 404);

      const categoryExist = await getRecord(
        category_id,
        "product_categories",
        "company_id",
        company_id,
        client
      );
      if (!categoryExist)
        throw new AppError("Product category not found", 404);
      if (brand_id) {

        const brandExist = await getRecord(
          brand_id,
          "brand",
          "company_id",
          company_id,
          client
        );
        if (!brandExist)
          throw new AppError("brand not found", 404);
      }

      const queryText = `
        INSERT INTO products (
          category_id,
          brand_id,
          name,
          short_name,
          description,
          sku,
          barcode,
          hsn_sac_code,
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
          $10,$11,$12,$13,$14,$15,$16
        )
        RETURNING *;
      `;

      const values = [
        category_id,
        brand_id,
        name,
        short_name,
        description,
        sku,
        barcode,
        hsn_sac_code,
        unit,
        cgst_rate ?? 0,
        sgst_rate ?? 0,
        igst_rate ?? 0,
        statusCode ?? 1,
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
    });
  }

  async fetchProducts(params: FetchProductParams) {
    const { filters = {} } = params;
    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    // ❌ Exclude deleted
    queryParams.push(0);
    whereConditions.push(`p.status != $${queryParams.length}`);

    // 🔍 Search
    if (filters.search) {
      queryParams.push(`%${filters.search}%`);
      const i = queryParams.length;

      whereConditions.push(`
      (
        p.name ILIKE $${i} OR
        p.sku ILIKE $${i} OR
        p.barcode ILIKE $${i} OR
        c.name ILIKE $${i} OR
        b.name ILIKE $${i}
      )
    `);
    }

    // 🏢 Company filter
    if (filters.company_id) {
      queryParams.push(filters.company_id);
      whereConditions.push(`p.company_id = $${queryParams.length}`);
    }

    // 🆔 Product filter
    if (filters.id) {
      queryParams.push(filters.id);
      whereConditions.push(`p.id = $${queryParams.length}`);
    }

    // 🏬 Firm filter (important for stock)
    if (filters.firm_id && filters.is_sale === true) {
      queryParams.push(filters.firm_id);
      whereConditions.push(`s.firm_id = $${queryParams.length}`);
    }

    // 🛒 Only products that exist in stock (for sale)
    if (filters.is_sale === true) {
      whereConditions.push(`
      EXISTS (
        SELECT 1 FROM stock s2
        WHERE s2.product_id = p.id
      )
    `);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // ============================
    // 📦 DATA QUERY
    // ============================
    const shouldJoinStock =
      filters.is_sale === true || !!filters.firm_id;

    const stockJoin = shouldJoinStock
      ? `
    LEFT JOIN stock s
      ON s.product_id = p.id
  `
      : "";
    const dataQuery = `
  SELECT 
    p.*,
    c.name AS category_name,
    b.name AS brand_name,

    ${shouldJoinStock
        ? `COALESCE(SUM(s.available_quantity), 0) AS total_quantity,

           CASE 
             WHEN COALESCE(SUM(s.available_quantity), 0) > 0 THEN true
             ELSE false
           END AS is_available`
        : `0 AS total_quantity,
           false AS is_available`
      }

  FROM products p

  LEFT JOIN product_categories c
    ON p.category_id = c.id

  LEFT JOIN brand b
    ON p.brand_id = b.id

  ${stockJoin}

  ${whereClause}

  GROUP BY p.id, c.name, b.name

  ORDER BY p.id DESC

  LIMIT $${queryParams.length + 1}
  OFFSET $${queryParams.length + 2}
`;

    const countQuery = `
  SELECT COUNT(DISTINCT p.id)
  FROM products p

  LEFT JOIN product_categories c
    ON p.category_id = c.id

  LEFT JOIN brand b
    ON p.brand_id = b.id

  ${stockJoin}

  ${whereClause}
`;
    const products = await query<Product>(
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
        totalPages: Math.ceil(
          Number(totalResult[0].count) / limit
        ),
      },
    };
  }


  async updateProduct(data: EditProductParams) {
    const { id, company_id, remarks, statusCode, category_id, brand_id, ...rest } = data;
    return transaction(async (client) => {
      const existing = await getRecord(
        id,
        "products",
        "company_id",
        company_id,
        client
      );

      if (!existing)
        throw new AppError("Product not found", 404);

      if (category_id && category_id !== existing.category_id) {
        const categoryExist = await getRecord(
          category_id,
          "product_categories",
          "company_id",
          company_id,
          client
        );
        if (!categoryExist)
          throw new AppError("Product category not found", 404);
      }
      if (brand_id && brand_id !== existing.brand_id) {
        const brandExist = await getRecord(
          brand_id,
          "brand",
          "company_id",
          company_id,
          client
        );
        if (!brandExist)
          throw new AppError("brand not found", 404);
      }
      const queryText = `
  UPDATE products
  SET
    category_id = $1,
    brand_id = $2,
    name = $3,
    short_name = $4,
    description = $5,
    sku = $6,
    barcode = $7,
    hsn_sac_code = $8,
    unit = $9,
    cgst_rate = $10,
    sgst_rate = $11,
    igst_rate = $12,
    status = $13,
    image = $14,
    remarks = CASE
      WHEN remarks IS NULL THEN $15::jsonb
      WHEN jsonb_typeof(remarks) = 'array'
        THEN remarks || $15::jsonb
      ELSE jsonb_build_array(remarks) || $15::jsonb
    END
  WHERE id = $16
  RETURNING *;
`;

      const values = [
        category_id ?? existing.category_id,
        brand_id ?? existing.brand_id,
        rest.name ?? existing.name,
        rest.short_name ?? existing.short_name,
        rest.description ?? existing.description,
        rest.sku ?? existing.sku,
        rest.barcode ?? existing.barcode,
        rest.hsn_sac_code ?? existing.hsn_sac_code,
        rest.unit ?? existing.unit,
        rest.cgst_rate ?? existing.cgst_rate,
        rest.sgst_rate ?? existing.sgst_rate,
        rest.igst_rate ?? existing.igst_rate,
        statusCode ?? existing.status,
        rest.image ?? existing.image,
        JSON.stringify(remarks),
        id
      ];

      const { rows } = await executeInTransaction(
        client,
        queryText,
        values
      );

      return rows[0];
    });
  }

  async deleteProduct(data: DeleteProductParams) {
    const { r_id, company_id, remarks } = data;

    return transaction(async (client) => {
      const existing = await getRecord(
        r_id,
        "products",
        "company_id",
        company_id,
        client
      );

      if (!existing)
        throw new AppError("Product not found", 404);

      const queryText = `
        UPDATE products
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

      await executeInTransaction(client, queryText, [
        JSON.stringify(remarks),
        r_id,
      ]);

      return `Product ${existing.name} deleted successfully`;
    });
  }
  async getProductReportSummary(data: GetProductReport) {

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