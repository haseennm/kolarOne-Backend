import { AppError } from "../../utils/AppError";
import { getStatusCode, getStatusText, isValidDateFormat } from "../../utils/extra";
import ProductService from "./product.service";
import {
  CreateProductBody,
  DeleteProductBody,
  EditProductBody,
  FetchProductParams,
  GetProductReport,
} from "./product.types";

export default class ProductController {
  async fetchProducts(data: FetchProductParams) {
    const service = new ProductService();
    if (data.filters.is_sale && !data.filters.firm_id) {
      throw new AppError("firm id is required", 400)
    }
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

  async createProduct(data: CreateProductBody) {
    const { created_by, status, image, ...rest } = data;

    const remarks = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };

    const statusCode = getStatusCode(status);

    const service = new ProductService();

    const product = await service.createProduct({
      ...rest,
      remarks,
      statusCode,
      image,
    });

    return product;
  }

  async editProduct(data: EditProductBody) {
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
    });

    return product;
  }

  async deleteProduct(data: DeleteProductBody) {
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
    });

    return product;
  }
  async getProductReport(data: GetProductReport) {

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