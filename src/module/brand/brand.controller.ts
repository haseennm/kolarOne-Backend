import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
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
    return transaction(async (client) => {
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

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "brand",
        tableRowId: brand.id,
        action: "create",
        record: { ...brand, name: brand.name },
      });

      return brand;
    });
  }
  async editBrand(data: EditBrandBody) {
    return transaction(async (client) => {
      const { updated_by, status, ...rest } = data;

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

      const { data: brand, changes } = await service.updateBrand({
        ...rest,
        statusCode,
        remark,
      });

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "brand",
        tableRowId: brand.id,
        action: "update",
        record: brand,
        changes: { brand: changes },
      });

      return { data: brand, changes };
    });
  }

  async deleteBrand(data: DeleteBrandBody) {
    return transaction(async (client) => {
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

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "brand",
        tableRowId: brand.id,
        action: "delete",
        record: brand,
      });

      return brand;
    });
  }
}