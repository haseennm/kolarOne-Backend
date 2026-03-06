import { executeInTransaction, query, transaction } from "../../config/db";
import { isExist } from "../../utils/extra";
import {
  CountResult,
  CreateProductParams,
  Product,
  DeleteProductParams,
  EditProductParams,
  FetchProductParams,
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
      base_price,
      cgst_rate,
      sgst_rate,
      igst_rate,
      image,
      remarks,
      statusCode
    } = data;

    return transaction(async (client) => {
      // Validate company
      const companyExist = await isExist(
        company_id,
        "company",
        "id",
        company_id,
        client
      );
      if (!companyExist) throw new AppError("Company not found", 404);

      // Validate category
      const categoryExist = await isExist(
        category_id,
        "product_categories",
        "company_id",
        company_id,
        client
      );
      if (!categoryExist)
        throw new AppError("Product category not found", 404);
      if (brand_id) {

        const brandExist = await isExist(
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
          base_price,
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
          $10,$11,$12,$13,$14,$15,$16,$17
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
        base_price,
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


    queryParams.push(0);
    whereConditions.push(`p.status != $${queryParams.length}`);

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

    if (filters.company_id) {
      queryParams.push(filters.company_id);
      whereConditions.push(`p.company_id = $${queryParams.length}`);
    }

    if (filters.id) {
      queryParams.push(filters.id);
      whereConditions.push(`p.id = $${queryParams.length}`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const dataQuery = `
  SELECT 
    p.*,
    c.name AS category_name,
    b.name AS brand_name
  FROM products p
  LEFT JOIN product_categories c
    ON p.category_id = c.id
  LEFT JOIN brand b
    ON p.brand_id = b.id
  ${whereClause}
  ORDER BY p.id DESC
  LIMIT $${queryParams.length + 1}
  OFFSET $${queryParams.length + 2}
`;
    const countQuery = `
      SELECT COUNT(*)
      FROM products p
      LEFT JOIN product_categories c
        ON p.category_id = c.id
      ${whereClause}
    `;

    const products = await query<Product>(
      dataQuery,
      [...queryParams, limit, offset]
    );

    const totalResult = await query<CountResult>(
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
      const existing = await isExist(
        id,
        "products",
        "company_id",
        company_id,
        client
      );

      if (!existing)
        throw new AppError("Product not found", 404);

      if (category_id && category_id !== existing.category_id) {
        const categoryExist = await isExist(
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
        const brandExist = await isExist(
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
    base_price = $10,
    cgst_rate = $11,
    sgst_rate = $12,
    igst_rate = $13,
    status = $14,
    image = $15,
    remarks = CASE
      WHEN remarks IS NULL THEN $16::jsonb
      WHEN jsonb_typeof(remarks) = 'array'
        THEN remarks || $16::jsonb
      ELSE jsonb_build_array(remarks) || $16::jsonb
    END
  WHERE id = $17
  RETURNING *;
`;

      const values = [
        category_id ?? existing.category_id,   // $1
        brand_id ?? existing.brand_id,         // $2
        rest.name ?? existing.name,                 // $3
        rest.short_name ?? existing.short_name,     // $4
        rest.description ?? existing.description,   // $5
        rest.sku ?? existing.sku,                   // $6
        rest.barcode ?? existing.barcode,           // $7
        rest.hsn_sac_code ?? existing.hsn_sac_code, // $8
        rest.unit ?? existing.unit,                 // $9
        rest.base_price ?? existing.base_price,     // $10
        rest.cgst_rate ?? existing.cgst_rate,       // $11
        rest.sgst_rate ?? existing.sgst_rate,       // $12
        rest.igst_rate ?? existing.igst_rate,       // $13
        statusCode ?? existing.status,              // $14
        rest.image ?? existing.image,               // $15
        JSON.stringify(remarks),                    // $16
        id                                          // $17
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
      const existing = await isExist(
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
}