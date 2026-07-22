
import { executeInTransaction, query, transaction } from "../../config/db";
import { getRecord, getStatusCode } from "../../utils/extra";
import {
  CountResult,
  CreateProductCatParams,
  DbProductCategory,
  DeleteProductCatParams,
  EditProductCatParams,
  FetchProductCatParams,
} from "./proCat.types";
import { AppError } from "../../utils/AppError";
import { PoolClient } from "pg";
import { buildAuditChanges } from "../journal/journal.utils";

export default class ProductCatService {
  async createProductCat(data: CreateProductCatParams, client: PoolClient) {
    const {
      company_id,
      description,
      image,
      name,
      parent_id,
      note,
      statusCode,
      remark,

    } = data;

    const isBranchExist = await getRecord(company_id, "company", "id", company_id, client);
    if (!isBranchExist) {
      throw new AppError("Company not found", 404);
    }
    if (parent_id) {
      const isProduct_cat_exist = await getRecord(parent_id, "product_categories", "company_id", company_id, client);

      if (!isProduct_cat_exist) {
        throw new AppError("parent category not found or deleted", 404);
      }
    }

    const queryText = `
    INSERT INTO product_categories (
    name ,
    parent_id ,
    company_id ,
    description ,
    note ,
    image ,
    status,
    remarks
    )
     VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
  `;
    const values = [
      name,
      parent_id,
      company_id,
      description,
      note,
      image,
      statusCode,
      JSON.stringify(remark),
    ];

    const { rows } = await executeInTransaction(client, queryText, values);
    return rows[0];
    ;
  }
  async fetchProductCategories(
    params: FetchProductCatParams
  ) {
    const { filters = {} } = params;

    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    queryParams.push(0);
    whereConditions.push(`pc.status != $${queryParams.length}`);

    if (filters.search) {
      queryParams.push(`%${filters.search}%`);
      const searchIndex = queryParams.length;

      whereConditions.push(`
      (
        pc.name ILIKE $${searchIndex} OR
        pc.description ILIKE $${searchIndex} OR
        parent.name ILIKE $${searchIndex} OR
        company.company_name ILIKE $${searchIndex}
      )
    `);
    }

    if (filters.id) {
      queryParams.push(filters.id);
      whereConditions.push(`pc.id = $${queryParams.length}`);
    }
    if (filters.parent_id) {
      queryParams.push(filters.parent_id);
      whereConditions.push(`pc.parent_id = $${queryParams.length}`);
    } else {
      whereConditions.push(`pc.parent_id IS NULL`);
    }

    if (filters.company_id) {
      queryParams.push(filters.company_id);
      whereConditions.push(`pc.company_id = $${queryParams.length}`);
    }

    if (filters.company_id) {
      queryParams.push(filters.company_id);
      whereConditions.push(`pc.company_id = $${queryParams.length}`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const dataQuery = `
    SELECT 
      pc.*,
      parent.name AS parent_name,
      company.company_name
    FROM product_categories pc
    LEFT JOIN product_categories parent 
      ON pc.parent_id = parent.id
    LEFT JOIN company 
      ON pc.company_id = company.id
    ${whereClause}
    ORDER BY pc.id DESC
    LIMIT $${queryParams.length + 1}
    OFFSET $${queryParams.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*) 
    FROM product_categories pc
    LEFT JOIN product_categories parent 
      ON pc.parent_id = parent.id
    LEFT JOIN company 
      ON pc.company_id = company.id
    ${whereClause}
  `;

    const categories = await query<DbProductCategory>(
      dataQuery,
      [...queryParams, limit, offset]
    );

    const totalResult = await query<CountResult>(
      countQuery,
      queryParams
    );

    return {
      data: categories.map((category) => ({
        ...category,
        parent_name: category.parent_name ?? null,
        company_name: category.company_name ?? null,
      })),
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


  async updateProductCat(data: EditProductCatParams, client: PoolClient) {
    const {
      id,
      company_id,
      description,
      image,
      name,
      parent_id,
      note,
      statusCode,
      remark,

    } = data;
    const isProduct_cat_exist = await getRecord(id, "product_categories", "company_id", company_id, client);

    if (!isProduct_cat_exist) {
      throw new AppError("product categories not found or deleted", 404);
    }

    const queryText = `
  UPDATE product_categories
SET
  name = $1,
  description = $2,
  parent_id = $3,
  note = $4,
  image = $5,
  status = $6,
  remarks =
    CASE
      WHEN remarks IS NULL THEN $7::jsonb
      WHEN jsonb_typeof(remarks) = 'array'
        THEN remarks || $7::jsonb
      ELSE jsonb_build_array(remarks) || $7::jsonb
    END
WHERE id = $8
RETURNING *;
  `;

    const values = [
      name ?? isProduct_cat_exist.name,
      description ?? isProduct_cat_exist.description,
      parent_id ?? isProduct_cat_exist.email,
      note ?? isProduct_cat_exist.note,
      image ?? isProduct_cat_exist.image,
      statusCode ?? isProduct_cat_exist.status,
      JSON.stringify(remark),
      id
    ];

    const { rows } = await executeInTransaction(client, queryText, values);
    const changes = buildAuditChanges(isProduct_cat_exist, rows[0]);
    return { data: rows[0], changes };

  }

  async deleteProductCat(data: DeleteProductCatParams, client: PoolClient) {
    const { r_id, remark, company_id, sub_cat_remark } = data;

    // 1. Verify the target product category exists
    const isProduct_cat_exist = await getRecord(r_id, "product_categories", "company_id", company_id, client);

    if (!isProduct_cat_exist) {
      throw new AppError("product category not found or deleted", 404);
    }

    // 2. Validate Stock for all cascading products (Direct products + Subcategory products)
    const stock_check_query = `
  SELECT 
    s.product_id,
    s.available_quantity,
    s.batch_number,
    p.name AS product_name
  FROM stock s
  JOIN products p ON s.product_id = p.id
  WHERE (
    p.category_id = $1
    OR p.category_id IN (
      SELECT id
      FROM product_categories
      WHERE parent_id = $1
      AND company_id = $2
    )
  )
  AND p.company_id = $2
  AND s.available_quantity > 0
  AND s.status = $3
  LIMIT 1;
`;

    const stockCheckResult = await executeInTransaction(
      client,
      stock_check_query,
      [r_id, company_id, getStatusCode("Good")]
    );

    if ((stockCheckResult.rowCount ?? 0) > 0) {
      const stock = stockCheckResult.rows[0];

      throw new AppError(
        `Cannot delete category. Product "${stock.product_name}" still has active stock in batch "${stock.batch_number}" with quantity ${stock.available_quantity}.`,
        400
      );
    }

    // 3. Delete products directly under the main category
    const delete_product_query_text = `
      UPDATE products
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE category_id =$3 AND company_id =$4
      RETURNING *;
    `;

    const delete_product_values = [
      getStatusCode("Deleted"),
      JSON.stringify(sub_cat_remark),
      r_id,
      company_id
    ];
    const deletedProducts = await executeInTransaction(
      client,
      delete_product_query_text,
      delete_product_values
    );

    // 4. Delete subcategories
    const delete_sub_query_text = `
      UPDATE product_categories
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE parent_id =$3 AND company_id =$4
      RETURNING *;
    `;

    const delete_sub_values = [
      getStatusCode("Deleted"),
      JSON.stringify(sub_cat_remark),
      r_id,
      company_id
    ];
    const deletedSubCategories = await executeInTransaction(
      client,
      delete_sub_query_text,
      delete_sub_values
    );

    // 5. Delete products belonging to subcategories
    const delete_sub_products_query = `
      UPDATE products
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE category_id IN (
        SELECT id
        FROM product_categories
        WHERE parent_id = $3
          AND company_id = $4
      )
      AND company_id = $4
      RETURNING *;
    `;

    const delete_sub_products_values = [
      getStatusCode("Deleted"),
      JSON.stringify(sub_cat_remark),
      r_id,
      company_id
    ];

    const deletedSubProducts = await executeInTransaction(
      client,
      delete_sub_products_query,
      delete_sub_products_values
    );

    // 6. Delete the main category itself
    const queryText = `
      UPDATE product_categories
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE id = $3
      RETURNING *;
    `;

    const values = [
      0, // Assumed status code for main deleted item
      JSON.stringify(remark),
      r_id,
    ];

    const { rows } = await executeInTransaction(client, queryText, values);

    const msg = `
      Product Category ${isProduct_cat_exist.name} deleted successfully.
      Deleted products: ${deletedProducts.rowCount}
      Deleted subcategory products: ${deletedSubProducts.rowCount}
      Deleted subcategories: ${deletedSubCategories.rowCount}
    `;
    return {
      deleted: msg,
      data: rows[0]
    }
  }

}