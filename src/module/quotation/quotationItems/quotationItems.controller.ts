import { PoolClient } from "pg";
import { ChangeQuotationItemStatus, CreateQuotationItemBody, DeleteQuotationItemBody, EditQuotationItemBody, FetchQuotationItemParams } from "./quotationItems.types";
import QuotationItemService from "./quotationItems.service";
import { getStatusCode, getStatusText } from "../../../utils/extra";

export default class QuotationItemController {

  async createQuotationItem(data: CreateQuotationItemBody, client: PoolClient) {
    const { status, ...rest } = data;


    const statusCode = getStatusCode(status ?? "Confirm");
    const remark = {
      action: "Created",
      created_at: Date.now(),
    }

    const service = new QuotationItemService();

    await service.createQuotationItems(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );
    return `sale item has been created successfully.`;
  }
  async editQuotationItem(data: EditQuotationItemBody, client: PoolClient) {
    const { status, ...rest } = data;

    let statusCode = undefined;
    if (status) statusCode = getStatusCode(status);

    const remark = {
      action: "Updated",
      updated_at: Date.now(),
    };

    const service = new QuotationItemService();

    const sale_item = await service.updateQuotationItem(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );

    return sale_item;
  }
  async fetchQuotationItems(data: FetchQuotationItemParams) {

    const service = new QuotationItemService();

    const rolesWithCode = await service.fetchQuotationItems(data);

    const roles = rolesWithCode.items.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      roles,
      pagination: { ...rolesWithCode.pagination }
    };
  }

  async deleteQuotationItem(data: DeleteQuotationItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new QuotationItemService();
    const sale_item = await service.deleteQuotationItem({ ...data, remark }, client);

    return sale_item;
  }
  async changeQuotationItemStatus(data: ChangeQuotationItemStatus, client: PoolClient) {

    const service = new QuotationItemService();
    const sale_item = await service.changeQuotationItemStatus({ ...data }, client);
    return sale_item;
  }
   async fetchItemsOnly(client: PoolClient, firm_id: number, quotation_id: number) {
      const service = new QuotationItemService();
      const items = service.fetchItemsOnly(client, firm_id, quotation_id)
      return items
    }
}