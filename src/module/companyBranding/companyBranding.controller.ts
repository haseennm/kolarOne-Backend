
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
import CompanyBrandingService from "./companyBranding.service";
import {
  CreateCompanyBrandingBody,
  DeleteCompanyBrandingBody,
  EditCompanyBrandingBody,
} from "./companyBranding.types";

export default class CompanyBrandingController {

  async fetchCompanyBranding(company_id: number) {
    const service = new CompanyBrandingService();

    const company_branding_with_code = await service.fetchCompanyBranding(company_id);

    const company_branding = company_branding_with_code.branding.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      data: {
        company_branding
      },
    };
  }

  async createCompanyBranding(data: CreateCompanyBrandingBody) {
    return transaction(async (client) => {
      const { created_by, logo, ...rest } = data;
      const companyId = data.company_id ?? 0;

      const remark = {
        action: "Created",
        created_by,
        created_at: Date.now(),
      };
      const allowed_string = ["Small", "Medium", "Large"];

      if (!allowed_string.includes(rest.font_size)) {
        throw new Error("Invalid font_size. Allowed values: Small, Medium, Large");
      }
      const statusCode = getStatusCode("Active");

      const service = new CompanyBrandingService();

      const company_branding = await service.createCompanyBranding({
        ...rest,
        remark,
        statusCode,
        logo
      }, client);

      await emitAuditJournal({
        client,
        entityId: companyId,
        entityType: "C",
        companyId,
        tableName: "company_branding",
        tableRowId: company_branding.id,
        action: "create",
        record: company_branding,
      });

      return company_branding;
    });
  }

  async editCompanyBranding(data: EditCompanyBrandingBody) {
    return transaction(async (client) => {
      const { updated_by, status, ...rest } = data;
      const companyId = data.company_id ?? 0;

      const remark = {
        action: "Updated",
        updated_by,
        updated_at: Date.now(),
      };
      let statusCode = undefined;
      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }
      const service = new CompanyBrandingService();
      const result = await service.updateCompany_branding({
        ...rest,
        remark,
        statusCode,
      }, client);

      await emitAuditJournal({
        client,
        entityId: companyId,
        entityType: "C",
        companyId,
        tableName: "company_branding",
        tableRowId: result.data.id,
        action: "update",
        record: result.data,
        changes: { "company branding": result.changes },
      });

      return result;
    });
  }

  async deleteCompanyBranding(data: DeleteCompanyBrandingBody) {
    return transaction(async (client) => {
      const { deleted_by, ...rest } = data;
      const companyId = data.company_id;
      const remark = {
        action: "Deleted",
        deleted_by,
        updated_at: Date.now(),
      };
      const service = new CompanyBrandingService();
      const company_branding = await service.deleteCompanyBranding({
        ...rest,
        remark,
      }, client);

      await emitAuditJournal({
        client,
        entityId: companyId,
        entityType: "C",
        companyId,
        tableName: "company_branding",
        tableRowId: company_branding.id,
        action: "delete",
        record: company_branding,
      });

      return company_branding;
    });
  }
}