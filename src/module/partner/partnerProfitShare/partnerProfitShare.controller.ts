import { convertEntityType, EntityKey, getStatusCode, getStatusText } from "../../../utils/extra";
import ProfitShareService from "./partnerProfitShare.service";
import { CreateProfitShareBody, DeletePartnerProfitBody, EditProfitShareBody, ProfitShareFilters, ProfitShareRow } from "./partnerProfitShare.types";


export default class ProfitShareController {
  private service = new ProfitShareService();

  async createProfitShare(data: CreateProfitShareBody) {
    const { created_by, status, entity_type, ...rest } = data;

    const remark = { action: "Created", created_by, created_at: Date.now() };
    const statusCode = getStatusCode(status);
    const dbEntityType = convertEntityType(entity_type as EntityKey);

    return this.service.createProfitShare({
      ...rest,
      entity_type: dbEntityType,
      remark,
      statusCode
    });
  }

  async fetchProfitShares(filters: ProfitShareFilters) {
    const result = await this.service.fetchProfitShares(filters);
    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      data: result.rows.map((r: any) => ({
        ...r,
        status: getStatusText(r.status)
      }))
    };
  }


  async editProfitShare(data: EditProfitShareBody) {
    const { updated_by, status, entity_type, ...rest } = data;
    const remark = { action: "Updated", updated_by, updated_at: Date.now() };
    let statusCode;
    if (status) statusCode = getStatusCode(status);
    const dbEntityType = convertEntityType(entity_type as EntityKey);

    return this.service.editProfitShare({ ...rest, remark, entity_type: dbEntityType, statusCode });
  }
   async deletePartnerProfit(data: DeletePartnerProfitBody) {
      const { deleted_by, ...rest } = data;
      const remark = { action: "Deleted", deleted_by, updated_at: Date.now() };
  
      return this.service.deletePartnerProfit({ ...rest, remark });
    }
}