import { getStatusCode, getStatusText } from "../../utils/extra";
import ProductService from "./product.service";
import {
  CreateProductBody,
  DeleteProductBody,
  EditProductBody,
  FetchProductParams,
} from "./product.types";

export default class ProductController {
  async fetchProducts(data: FetchProductParams) {
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
}