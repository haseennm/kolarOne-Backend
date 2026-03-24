import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { cns, getStatusCode, getStatusText } from "../../../utils/extra";
import PurchaseReturnItemService from "./purchaseReturnItems.service";
import { AppError } from "../../../utils/AppError";
import { CreatePurchaseRetunItemBody, DeletePurchaseReturnItemBody, FetchPurchaseReturnItemFilters, FetchPurchaseReturnItemParams } from "./purchaseReturnItems.types";

export default class PurchaseReturnItemController {

  async createPurchaseReturnItem(data: CreatePurchaseRetunItemBody, client: PoolClient) {
    const { status, ...rest } = data;


    const statusCode = getStatusCode(status);
    const remark = {
      action: "Created",
      created_at: Date.now(),
    }
  
    const service = new PurchaseReturnItemService();

    await service.createPurchaseReturnItems(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );


    return `purchaseItem has been created successfully.`;
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
  async fetchPurchaseItems(data: FetchPurchaseReturnItemParams) {

    const service = new PurchaseReturnItemService();

    const rolesWithCode = await service.fetchPurchaseReturnItems(data);

    const roles = rolesWithCode.items.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      roles,
      pagination: { ...rolesWithCode.pagination }
    };
  }




  async deletePurchaseItem(data: DeletePurchaseReturnItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new PurchaseReturnItemService();
    await service.deletePurchaseReturnItem({...data,remark},  client);

    return `Purchase item has been deleted successfully.`;
  }
}