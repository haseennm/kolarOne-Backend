import { transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { convertEntityType, EntityKey, getStatusCode, getStatusText } from "../../../utils/extra";
import ProfitShareService from "./partnerProfitShare.service";
import { CreateProfitShareBody, DeletePartnerProfitBody, EditProfitShareBulkBody, ProfitShareFilters, ProfitShareRow } from "./partnerProfitShare.types";


export default class ProfitShareController {
  private service = new ProfitShareService();

  async createProfitShare(data: CreateProfitShareBody) {
    const { created_by, entities, ...rest } = data;

    const remark = { action: "Created", created_by, created_at: Date.now() };
    const statusCode = getStatusCode("Active");

    return transaction(async (client) => {
      const results = [];

      for (const entity of entities) {
        const dbEntityType = convertEntityType(entity.entity_type as EntityKey);

        const result = await this.service.createProfitShare(
          {
            ...rest,
            entity_id: entity.entity_id,
            entity_type: dbEntityType,
            profit_share: entity.profit_share,
            remark,
            statusCode
          },
          client
        );

        results.push(result);
      }

      return results;
    });
  }

  async fetchProfitShares(filters: ProfitShareFilters) {
    const { entity_type, entity_id, ...rest } = filters
    let dbEntityType = undefined
    if ((entity_type && !entity_id) || (!entity_type && entity_id)) {
      throw new AppError(
        "Both entity_type and entity_id must be provided together",
        400
      );
    }
    if (entity_type) dbEntityType = convertEntityType(entity_type as EntityKey);

    const result = await this.service.fetchProfitShares({
      entity_type: dbEntityType,
      entity_id,
      ...rest
    });

    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      data: result.rows.map((r: any) => {
        const { remarks, ...restRow } = r;

        return {
          ...restRow,
          status: getStatusText(r.status),
        };
      })
    };
  }

  async editProfitShare(data: EditProfitShareBulkBody) {
    const { updated_by, entities } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now()
    };

    return transaction(async (client) => {
      const results = [];

      for (const entity of entities) {
        const dbEntityType = convertEntityType(entity.entity_type as EntityKey);

        let statusCode;
        if (entity.status) {
          statusCode = getStatusCode(entity.status);
        }

        const result = await this.service.editProfitShare(
          {
            id: entity.id,
            entity_id: entity.entity_id,
            entity_type: dbEntityType,
            profit_share: entity.profit_share,
            statusCode,
            remark
          },
          client
        );

        results.push(result);
      }

      return results;
    });
  }
  async deletePartnerProfit(data: DeletePartnerProfitBody) {
    const { deleted_by, ...rest } = data;
    const remark = { action: "Deleted", deleted_by, updated_at: Date.now() };

    return this.service.deletePartnerProfit({ ...rest, remark });
  }
}