import { getStatusCode, getStatusText } from "../../utils/extra";
import VendorService from "./vendor.service";
import {
  CreateVendorBody,
  DeleteVendorBody,
  EditVendorBody,
  FetchVendorParams
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
}