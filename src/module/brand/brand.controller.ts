import { AppError } from "../../utils/AppError";
import { getStatusCode, getStatusText } from "../../utils/extra";
import BrandService from "./brand.service";
import {
  CreateBrandBody,
  DeleteBrandBody,
  EditBrandBody,
  FetchBrandParams,
} from "./brand.types";

export default class BrandController {

   async fetchBrand(data: FetchBrandParams) {
    const service = new BrandService();

    const brand_with_code = await service.fetchBrand(data);

    const brand = brand_with_code.brand.map((row: any) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      pagination: {
        page: brand_with_code.page,
        limit: brand_with_code.limit,
        total: brand_with_code.total,
      },
      data: {
        brand,
      },
    };
  }

   async createBrand(data: CreateBrandBody) {
    const { created_by, status, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now()
    };

    const statusCode = getStatusCode(status ?? "Active");

    const service = new BrandService();

    const brand = await service.createBrand({
      ...rest,
      statusCode: statusCode,
      remark
    });

    return brand;
  }
 async editBrand(data: EditBrandBody) {
    const { updated_by, status,  ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now()
    };

    let statusCode = 99;
    if (status) {
      statusCode = getStatusCode(status);
    }

    const service = new BrandService();

    const brand = await service.updateBrand({
      ...rest,
      statusCode,
      remark,
    });

    return brand;
  }

   async deleteBrand(data: DeleteBrandBody) {
    const { deleted_by, ...rest } = data;

    const brandRemark = {
      action: "Deleted",
      deleted_by,
      deleted_at: Date.now(),
    };

    const service = new BrandService();

    const brand = await service.deleteBrand({
      ...rest,
      remark: brandRemark,
    });

    return brand;
  }
}