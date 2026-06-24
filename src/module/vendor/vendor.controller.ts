import { AppError } from "../../utils/AppError";
import { getStatusCode, getStatusText, isValidDateFormat } from "../../utils/extra";
import VendorService from "./vendor.service";
import {
  AddNewFirm,
  CreateVendorBody,
  DeleteVendorBody,
  EditVendorBody,
  FetchVendorParams,
  RemoveFirmVendor,
} from "./vendor.types";

export default class VendorController {

  async fetchVendor(data: FetchVendorParams) {

    const service = new VendorService();

    const result = await service.fetchVendor(data);

    const vendors = result.vendors.map(v => ({
      ...v,
      status: getStatusText(v.status)
    }));

    return {
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      },
      data: { vendors }
    };
  }

  async addnewFirm(data: AddNewFirm) {

    const { firm_name, ...rest } = data;

    const remark = {
      action: "Add new Firm",
      firm_name,
      added_at: Date.now()
    };

    const service = new VendorService();

    return service.addVendorNewFirm({
      ...rest, firm_name
    }, remark);
  }
  async createVendor(data: CreateVendorBody) {

    const { created_by, status, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now()
    };

    const statusCode = getStatusCode(status);

    const service = new VendorService();

    return service.createVendor({
      ...rest,
      remark,
      statusCode
    });
  }

  async editVendor(data: EditVendorBody) {

    const { updated_by, status, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now()
    };

    let statusCode;

    if (typeof status === "string") {
      statusCode = getStatusCode(status);
    }

    const service = new VendorService();

    return service.updateVendor({
      ...rest,
      remark,
      statusCode
    });
  }

  async deleteVendor(data: DeleteVendorBody) {

    const { deleted_by, ...rest } = data;

    const remark = {
      action: "Deleted",
      deleted_by,
      updated_at: Date.now()
    };

    const service = new VendorService();

    return service.deleteVendor({
      ...rest,
      remark
    });
  }
  async removeFirmVendor(data: RemoveFirmVendor) {


    const remark = {
      action: "Removed firm",
      firm_name: data.firm_name,
      updated_at: Date.now()
    };

    const service = new VendorService();

    return service.removeFirmVendor({
      ...data,
      remark
    });
  }
  async getVendorReport(data: {
    level: "firm" | "branch" | "company";
    firm_id?: number;
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
  }) {

    const {
      level,
      firm_id,
      branch_id,
      company_id,
      start_date,
      end_date
    } = data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required", 400);
    }

    if (level === "company" && !company_id) {
      throw new AppError("company_id is required", 400);
    }

    const hasDate =
      start_date &&
      end_date &&
      isValidDateFormat(start_date) &&
      isValidDateFormat(end_date);

    /* ================= SERVICE ================= */

    const service = new VendorService();

    return service.getVendorReportSummary({
      level,
      firm_id,
      branch_id,
      company_id,
      start_date: hasDate ? start_date : undefined,
      end_date: hasDate ? end_date : undefined
    });
  }
}