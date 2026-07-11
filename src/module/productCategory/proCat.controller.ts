import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import ProductCatService from "./proCat.service";
import {
  CreateProductCatBody,
  DeleteProductCatBody,
  EditProductCatBody,
  FetchProductCatParams,
} from "./proCat.types";
import { emitAuditJournal } from "../journal/journal.utils";

export default class ProCatController {

  async fetchProCat(data: FetchProductCatParams) {
    const service = new ProductCatService();

    const cat_with_code = await service.fetchProductCategories(data);

    const product_categories = cat_with_code.data.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      pagination: {
        page: cat_with_code.pagination.page,
        limit: cat_with_code.pagination.limit,
        total: cat_with_code.pagination.total,
      },
      data: {
        product_categories: product_categories,
      },
    };
  }

  async createProductCat(data: CreateProductCatBody) {
    return transaction(async (client: PoolClient) => {

      const { created_by, status, image, ...rest } = data;

      const remark = {
        action: "Created",
        created_by,
        created_at: Date.now(),
      };

      const statusCode = getStatusCode(status);

      const service = new ProductCatService();

      const product_category = await service.createProductCat({
        ...rest,
        remark,
        statusCode,
        image
      }, client);
      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: rest.company_id,
        tableName: "product_categories",
        tableRowId: product_category.id,
        action: "create",
        record: product_category,
      });
      return product_category;
    })
  }

  async editProductCat(data: EditProductCatBody) {
    return transaction(async (client: PoolClient) => {

      const { updated_by, status, ...rest } = data;

      const remark = {
        action: "Updated",
        updated_by,
        updated_at: Date.now(),
      };

      let statusCode;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const service = new ProductCatService();

      const product_category = await service.updateProductCat({
        ...rest,
        remark,
        statusCode,
      }, client);
      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: rest.company_id,
        tableName: "product_categories",
        tableRowId: product_category.data.id,
        action: "update",
        record: product_category,
        changes: { product_categories: product_category.changes },
      });
      return product_category;
    })
  }

  async deleteProductCat(data: DeleteProductCatBody) {
    return transaction(async (client: PoolClient) => {

      const { deleted_by, ...rest } = data;

      const remark = {
        action: "Deleted",
        deleted_by,
        updated_at: Date.now(),
      };
      const sub_cat_remark = {
        action: "Deleted Due to delete parent category",
        deleted_by,
        deleted_at: Date.now(),
      };
      const service = new ProductCatService();

      const product_category = await service.deleteProductCat({
        ...rest,
        remark,
        sub_cat_remark
      }, client);
      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: rest.company_id,
        tableName: "product_categories",
        tableRowId: product_category.data.id,
        action: "delete",
        record: product_category.data,
      });
      return product_category;
    })
  }
}