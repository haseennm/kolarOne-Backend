import { AppError } from "../../middleware/errorMiddlware";
import { generateToken, hashPassword, verifyPassword } from "../../utils/auth.util";
import { getStatusCode, getStatusText } from "../../utils/extra";
import ProductCatService from "./proCat.service";
import {
  CreateProductCatBody,
  DeleteProductCatBody,
  EditProductCatBody,
  FetchProductCatParams,
} from "./proCat.types";

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
    const { created_by, status, image, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };

    const statusCode = getStatusCode(status);

    const service = new ProductCatService();

    const firm = await service.createProductCat({
      ...rest,
      remark,
      statusCode,
      image
    });

    return firm;
  }

  async editProductCat(data: EditProductCatBody) {
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
    });

    return product_category;
  }

  async deleteProductCat(data: DeleteProductCatBody) {
    const { deleted_by, ...rest } = data;

    const remark = {
      action: "Deleted",
      deleted_by,
      updated_at: Date.now(),
    };

    const service = new ProductCatService();

    const product_category = await service.deleteProductCat({
      ...rest,
      remark,
    });

    return product_category;
  }
}