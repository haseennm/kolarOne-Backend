import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { cns, getStatusCode, getStatusText } from "../../../utils/extra";
import { AppError } from "../../../utils/AppError";
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




  async deleteSaleItem(data: DeleteSaleReturnItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new SaleReturnItemService();
    await service.deleteSaleReturnItem({...data,remark},  client);

    return `Sale item has been deleted successfully.`;
  }
}