import { getStatusCode, getStatusText } from "../../../utils/extra";
import PartnerService from "./partnerinfo.service";
import {
  CreatePartnerBody,
  DeletePartnerBody,
  EditPartnerBody,
  FetchPartnerParams
} from "./partnerinfo.types";

export default class PartnerController {
  private service = new PartnerService();

  async fetchPartners(data: FetchPartnerParams) {
    const result = await this.service.fetchPartners(data);
    const partners = result.partners.map(p => ({
      ...p,
      status: getStatusText(p.status)
    }));

    return {
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      },
      data: { partners }
    };
  }

  async createPartner(data: CreatePartnerBody) {
    const { created_by, status, ...rest } = data;
    const remark = { action: "Created", created_by, created_at: Date.now() };
    const statusCode = getStatusCode(status);

    return this.service.createPartner({ ...rest, remark, statusCode });
  }

  async editPartner(data: EditPartnerBody) {
    const { updated_by, status, ...rest } = data;
    const remark = { action: "Updated", updated_by, updated_at: Date.now() };
    
    let statusCode;
    if (status) statusCode = getStatusCode(status);

    return this.service.updatePartner({ ...rest, remark, statusCode });
  }

  async deletePartner(data: DeletePartnerBody) {
    const { deleted_by, ...rest } = data;
    const remark = { action: "Deleted", deleted_by, updated_at: Date.now() };

    return this.service.deletePartner({ ...rest, remark });
  }
}