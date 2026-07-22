import { PoolClient } from "pg";
import {  getStatusCode } from "../../../utils/extra";
import PurchaseReturnItemService from "./purchaseReturnItems.service";
import { CreatePurchaseRetunItemBody, DeletePurchaseReturnItemBody, EditPurchaseReturnItemBody, FetchPurchaseReturnItemFilters, FetchPurchaseReturnItemParams } from "./purchaseReturnItems.types";

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
  async editPurchaseReturnItem(data: EditPurchaseReturnItemBody, client: PoolClient) {
    const { status, ...rest } = data;

    let statusCode = undefined
    if (status) statusCode = getStatusCode(status);

    const remark = {
      action: "Update",
      created_at: Date.now(),
    }

    const service = new PurchaseReturnItemService();
    const purchase_item = service.updatePurchaseReturnItem(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );


    return purchase_item;
  }
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
  async deletePurchaseItem(data: DeletePurchaseReturnItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new PurchaseReturnItemService();
    await service.deletePurchaseReturnItem({ ...data, remark }, client);

    return `Purchase item has been deleted successfully.`;
  }
  async fetchItemsOnly(client: PoolClient, firm_id: number, purchase_return_id: number) {
    const service = new PurchaseReturnItemService();
    const items = service.fetchItemsOnly(client, firm_id, purchase_return_id)
    return items
  }
}