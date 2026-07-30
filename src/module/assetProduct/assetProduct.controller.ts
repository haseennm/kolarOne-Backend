import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getStatusCode, getStatusText, isValidDateFormat } from "../../utils/extra";
import ProductService from "./assetProduct.service";
import {
  CreateAssetProductBody,
  DeleteAssetProductBody,
  EditAssetProductBody,
  FetchAssetProductParams,
  GetAssetProductReport,
} from "./assetProduct.types";
import { emitAuditJournal } from "../journal/journal.utils";

export default class ProductController {
  async fetchProducts(data: FetchAssetProductParams) {
    const service = new ProductService();
    const products_with_code = await service.fetchProducts(data);

    const products = products_with_code.data.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      pagination: {
        page: products_with_code.pagination.page,
        limit: products_with_code.pagination.limit,
        total: products_with_code.pagination.total,
      },
      data: {
        products,
      },
    };
  }

  async createProduct(data: CreateAssetProductBody) {
    const { created_by, image, ...rest } = data;
    return transaction(async (client: PoolClient) => {

      const remarks = {
        action: "Created",
        created_by,
        created_at: Date.now(),
      };
      const service = new ProductService();
      const product = await service.createProduct({
        ...rest,
        remarks,
        image,
      }, client);
      // await emitAuditJournal({
      //   client,
      //   entityId: rest.company_id,
      //   entityType: "C",
      //   companyId: rest.company_id,
      //   tableName: "products",
      //   tableRowId: product.id,
      //   action: "create",
      //   record: product,
      // });
      return product;
    })
  }

  async editProduct(data: EditAssetProductBody) {
    return transaction(async (client: PoolClient) => {

      const { updated_by, status, ...rest } = data;

      const remarks = {
        action: "Updated",
        updated_by,
        updated_at: Date.now(),
      };

      let statusCode;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const service = new ProductService();

      const product = await service.updateProduct({
        ...rest,
        remarks,
        statusCode,
      }, client);
      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: rest.company_id,
        tableName: "products",
        tableRowId: rest.id,
        action: "update",
        record: product.data,
        changes: { product: product.changes },
      });
      return product;
    })
  }

  async deleteProduct(data: DeleteAssetProductBody) {
    return transaction(async (client: PoolClient) => {

      const { deleted_by, ...rest } = data;

      const remarks = {
        action: "Deleted",
        deleted_by,
        deleted_at: Date.now(),
      };

      const service = new ProductService();

      const product = await service.deleteProduct({
        ...rest,
        remarks,
      }, client);
      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: rest.company_id,
        tableName: "products",
        tableRowId: rest.r_id,
        action: "delete",
        record: product,
      });
      return product;
    })
  }
  async getProductReport(data: GetAssetProductReport) {

    const { level, end_date, start_date, ...rest } = data;

    /* ================= VALIDATION ================= */
    if (start_date && !isValidDateFormat(start_date)) {
      throw new AppError("Invalid start_date format (YYYY-MM-DD)", 400)
    }

    if (end_date && !isValidDateFormat(end_date)) {
      throw new AppError("Invalid end date format (YYYY-MM-DD)", 400)
    }
    if (!level) {
      throw new AppError("level is required", 400);
    }

    if (level === "firm" && !data.firm_id) {
      throw new AppError("firm_id is required", 400);
    }

    if (level === "branch" && !data.branch_id) {
      throw new AppError("branch_id is required", 400);
    }

    if (level === "company" && !data.company_id) {
      throw new AppError("company_id is required", 400);
    }

    /* ================= SERVICE ================= */

    const service = new ProductService();

    const report = await service.getProductReportSummary(data);

    return report;
  }
}