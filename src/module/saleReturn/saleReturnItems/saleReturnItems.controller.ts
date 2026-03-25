import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { cns, getStatusCode, getStatusText } from "../../../utils/extra";
import PurchaseReturnItemService from "./saleReturnItems.service";
import { AppError } from "../../../utils/AppError";
import { CreateSaleRetunItemBody, DeleteSaleReturnItemBody, FetchSaleReturnItemFilters, FetchSaleReturnItemParams } from "./saleReturnItems.types";
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
  // async editPurchaseItem(data: EditPurchaseReturnItemBody, client: PoolClient) {
  //   cns("create purchase items", data)
  //   const { status, ...rest } = data;

  //   let statusCode = undefined
  //   if (status) statusCode = getStatusCode(status);

  //   const remark = {
  //     action: "Update",
  //     created_at: Date.now(),
  //   }

  //   const service = new PurchaseReturnItemService();

  //   const purchase_item = service.updatePurchaseItem(
  //     {
  //       ...rest,
  //       statusCode,
  //       remark
  //     },
  //     client
  //   );


  //   return purchase_item;
  // }
  // async fetchPurchaseItems(data: FetchPurchaseReturnItemParams) {

  //   const service = new PurchaseReturnItemService();

  //   const rolesWithCode = await service.fetchPurchaseReturnItems(data);

  //   const roles = rolesWithCode.items.map((row) => ({
  //     ...row,
  //     status: getStatusText(row.status),
  //   }));

  //   return {
  //     roles,
  //     pagination: { ...rolesWithCode.pagination }
  //   };
  // }




  async deleteSaleItem(data: DeleteSaleReturnItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new PurchaseReturnItemService();
    await service.deletePurchaseReturnItem({...data,remark},  client);

    return `Purchase item has been deleted successfully.`;
  }
}