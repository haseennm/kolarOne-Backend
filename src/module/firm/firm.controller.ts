import { AppError } from "../../utils/AppError";
import { generateToken, hashPassword, verifyPassword } from "../../utils/auth.util";
import { getStatusCode, getStatusText } from "../../utils/extra";
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

    return firm;
  }

  async editFirm(data: EditFirmBody) {
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

    const firm = await service.updateFirm({
      ...rest,
      remark,
      statusCode,
    });

    return firm;
  }

  async deleteFirm(data: DeleteFirmBody) {
    const { deleted_by, ...rest } = data;

    const remark = {
      action: "Deleted",
      deleted_by,
      updated_at: Date.now(),
    };

    const service = new FirmService();

    const firm = await service.deleteFirm({
      ...rest,
      remark,
    });

    return firm;
  }
  async loginFirm(data: FirmLoginBody) {
    const { password, username } = data;

    const service = new FirmService();
    const firm = await service.loginFirm(data);

    console.log("firm in controller", firm);

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
      message: `Firm ${firm.firm_name} Login success`,
      role: firm.role
    };
  }
}