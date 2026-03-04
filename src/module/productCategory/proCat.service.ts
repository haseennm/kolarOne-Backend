import { Result } from "pg";
import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../middleware/errorMiddlware";
import { cns, isExist } from "../../utils/extra";
import {
  CountResult,
  CreateProductCatParams,
  DbProductCategory,
  DeleteProductCatParams,
  EditProductCatParams,
  FetchProductCatParams,
} from "./proCat.types";

export default class ProductCatService {
  async createProductCat(data: CreateProductCatParams) {
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
    const result = transaction(async (client) => {

      const isBranchExist = await isExist(company_id, "company", "id", company_id, client);
      if (!isBranchExist) {
        throw new AppError("Company not found", 404);
      }
      if (parent_id) {
        const isProduct_cat_exist = await isExist(parent_id, "product_categories", "company_id", company_id, client);

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
      console.log(typeof parent_id)
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
      cns("insert cat", values)
      const { rows } = await executeInTransaction(client, queryText, values);
      return `${rows[0].name} created`;
    })
    return result;
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

    // Exclude deleted (assuming 0 = deleted)
    queryParams.push(0);
    whereConditions.push(`pc.status != $${queryParams.length}`);

    // Search filter
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

    // Filter by ID
    if (filters.id) {
      queryParams.push(filters.id);
      whereConditions.push(`pc.id = $${queryParams.length}`);
    }

    // Filter by Branch
    if (filters.company_id) {
      queryParams.push(filters.company_id);
      whereConditions.push(`pc.company_id = $${queryParams.length}`);
    }

    // Filter by Company
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


  async updateProductCat(data: EditProductCatParams) {
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
    const result = transaction(async (client) => {
      const isProduct_cat_exist = await isExist(id, "product_categories", "company_id", company_id, client);

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
      return rows[0];
    })
    return result
  }

  async deleteProductCat(data: DeleteProductCatParams) {
    const { r_id, remark, company_id } = data;
    const result = transaction(async (client) => {
      const isProduct_cat_exist = await isExist(r_id, "product_categories", "company_id", company_id, client);

      if (!isProduct_cat_exist) {
        throw new AppError("product category not found or deleted", 404);
      }

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
        0, // soft delete (same as your branch logic)
        JSON.stringify(remark),
        r_id,
      ];

      await executeInTransaction(client, queryText, values);

      return `Firm ${isProduct_cat_exist.name} Deleted Successfully`;
    })
    return result
  }

}