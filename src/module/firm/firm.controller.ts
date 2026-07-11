import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { generateToken, hashPassword, verifyPassword } from "../../utils/auth.util";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
import FirmService from "./firm.service";
import {
  CreateFirmBody,
  DeleteFirmBody,
  EditFirmBody,
  FetchFirmParams,
  FirmLoginBody,
} from "./firm.types";

export default class FirmController {

  async fetchFirm(data: FetchFirmParams) {
    const service = new FirmService();

    const firm_with_code = await service.fetchFirm(data);

    const firm = firm_with_code.firm.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      pagination: {
        page: firm_with_code.page,
        limit: firm_with_code.limit,
        total: firm_with_code.total,
      },
      data: {
        firm: firm,
      },
    };
  }

  async createFirm(data: CreateFirmBody) {
    return transaction(async (client) => {
      const { created_by, status, password, logo, ...rest } = data;

      const remark = {
        action: "Created",
        created_by,
        created_at: Date.now(),
      };

      const statusCode = getStatusCode(status);
      const hashed = await hashPassword(password)

      const service = new FirmService();

      const firm = await service.createFirm({
        ...rest,
        remark,
        statusCode,
        hashed,
        logo
      });

      await emitAuditJournal({
        client,
        entityId: firm.id,
        entityType: "F",
        companyId: data.company_id,
        tableName: "firm",
        tableRowId: firm.id,
        action: "create",
        record: firm,
      });

      return firm;
    });
  }

  async editFirm(data: EditFirmBody) {
    return transaction(async (client) => {
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

      const service = new FirmService();

      const { data: firm, changes } = await service.updateFirm({
        ...rest,
        remark,
        statusCode,
      });

      await emitAuditJournal({
        client,
        entityId: firm.id,
        entityType: "F",
        companyId: data.company_id,
        tableName: "firm",
        tableRowId: firm.id,
        action: "update",
        record: firm,
        changes:{firm:changes},
      });

      return { data: firm, changes };
    });
  }

  async deleteFirm(data: DeleteFirmBody) {
    return transaction(async (client) => {
      const { deleted_by, ...rest } = data;

      const remark = {
        action: "Deleted",
        deleted_by,
        updated_at: Date.now(),
      };

      const service = new FirmService();
      const companyId = data.company_id ?? 0;

      const firm = await service.deleteFirm({
        ...rest,
        remark,
      });

      await emitAuditJournal({
        client,
        entityId: firm.id,
        entityType: "F",
        companyId,
        tableName: "firm",
        tableRowId: firm.id,
        action: "delete",
        record: firm,
      });

      return firm;
    });
  }
  async loginFirm(data: FirmLoginBody) {
    const { password, username } = data;

    const service = new FirmService();
    const firm = await service.loginFirm(data);
    if (!firm) {
      throw new AppError("Firm not found", 401);
    }

    const isValid = await verifyPassword(password, firm.password);

    if (!isValid) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = generateToken({
      id: firm.id,
      username: username,
    });

    return {
      token: token,
      branch_id: firm.branch_id,
      company_id: firm.company_id,
      state: firm.state,
      message: `Firm ${firm.firm_name} Login success`,
      name:firm.firm_name,
      role: firm.role
    };
  }
}