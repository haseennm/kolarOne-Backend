import { PoolClient } from "pg";
import { getStatusCode } from "../../../utils/extra";
import { CreateSaleRetunItemBody, DeleteSaleReturnItemBody, EditSaleRetunItemBody, FetchSaleReturnItemFilters, FetchSaleReturnItemParams } from "./saleReturnItems.types";
import SaleReturnItemService from "./saleReturnItems.service";

export default class SaleReturnItemController {

  async createSaleReturnItem(data: CreateSaleRetunItemBody, client: PoolClient) {
    const { status, ...rest } = data;
    const statusCode = getStatusCode(status);
    const remark = {
      action: "Created",
      created_at: Date.now(),
    }
  
    const service = new SaleReturnItemService();

    await service.createSaleReturnItems(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );


    return `SaleItem has been created successfully.`;
  }

  async editSaleReturnItem(data: EditSaleRetunItemBody, client: PoolClient) {
    const { status, ...rest } = data;
    
    let statusCode = undefined;
    if (status) statusCode = getStatusCode(status);

    const remark = {
      action: "Updated",
      updated_at: Date.now(),
    };

    const service = new SaleReturnItemService();

    const sale_return_item = await service.updateSaleReturnItem(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );
    return sale_return_item;
  }

  async fetchItemsOnly(client: PoolClient, firm_id: number, sale_return_id: number) {
    const service = new SaleReturnItemService();
    const items = service.fetchItemsOnly(client, firm_id, sale_return_id)
    return items
  }


  async deleteSaleItem(data: DeleteSaleReturnItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new SaleReturnItemService();
    const deletedItem =await service.deleteSaleReturnItem({...data,remark},  client);

    return deletedItem;
  }
}