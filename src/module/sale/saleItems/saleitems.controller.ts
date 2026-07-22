import { PoolClient } from "pg";
import { getStatusCode, getStatusText } from "../../../utils/extra";
import { CreateSaleItemBody, DeleteSaleItemBody, EditSaleItemBody, FetchSaleItemParams } from "./saleitems.types";
import SaleItemService from "./saleitems.service";

export default class SaleItemController {

  async createSaleItem(data: CreateSaleItemBody, client: PoolClient) {
    const { status, ...rest } = data;


    const statusCode = getStatusCode(status);
    const remark = {
      action: "Created",
      created_at: Date.now(),
    }

    const service = new SaleItemService();

    await service.createSaleItems(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );
    return `sale item has been created successfully.`;
  }
  async editSaleItem(data: EditSaleItemBody, client: PoolClient) {
    const { status, ...rest } = data;

    let statusCode = undefined;
    if (status) statusCode = getStatusCode(status);

    const remark = {
      action: "Updated",
      updated_at: Date.now(),
    };

    const service = new SaleItemService();

    const sale_item = await service.updateSaleItem(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );

    return sale_item;
  }
  async fetchSaleItems(data: FetchSaleItemParams) {

    const service = new SaleItemService();

    const rolesWithCode = await service.fetchSaleItems(data);

    const roles = rolesWithCode.items.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      roles,
      pagination: { ...rolesWithCode.pagination }
    };
  }

  async fetchItemsOnly(client: PoolClient, firm_id: number, sale_id: number) {
    const service = new SaleItemService();
    const items = service.fetchItemsOnly(client, firm_id, sale_id)
    return items
  }



  async deleteSaleItem(data: DeleteSaleItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new SaleItemService();
    const sale_item = await service.deleteSaleItem({ ...data, remark }, client);

    return sale_item;
  }
}