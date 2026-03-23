import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { cns, getStatusCode, getStatusText } from "../../../utils/extra";
import { CreatePurchaseItemBody, DeletePurchaseItemBody, EditPurchaseItemBody, FetchPurchaseItemParams } from "./purchaseitems.types";
import PurchaseItemService from "./purchaseitems.service";
import { AppError } from "../../../utils/AppError";

export default class PurchaseItemController {

  async createPurchaseItem(data: CreatePurchaseItemBody, client: PoolClient) {
    cns("create purchase items", data)
    const { status, ...rest } = data;


    const statusCode = getStatusCode(status);
    const remark = {
      action: "Created",
      created_at: Date.now(),
    }
    if (rest.received_qty > rest.purchased_qty) {
      throw new AppError(
        "Received quantity cannot exceed purchased quantity",
        422
      );
    }
    const service = new PurchaseItemService();

    await service.createPurchaseItems(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );


    return `purchaseItem has been created successfully.`;
  }
  async editPurchaseItem(data: EditPurchaseItemBody, client: PoolClient) {
    cns("create purchase items", data)
    const { status, ...rest } = data;

    let statusCode = undefined
    if (status) statusCode = getStatusCode(status);

    const remark = {
      action: "Update",
      created_at: Date.now(),
    }

    const service = new PurchaseItemService();

    const purchase_item = service.updatePurchaseItem(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );


    return purchase_item;
  }
  async fetchPurchaseItems(data: FetchPurchaseItemParams) {

    const service = new PurchaseItemService();

    const rolesWithCode = await service.fetchPurchaseItems(data);

    const roles = rolesWithCode.items.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      roles,
      pagination: { ...rolesWithCode.pagination }
    };
  }




  async deletePurchaseItem(data: DeletePurchaseItemBody, client: PoolClient) {

    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new PurchaseItemService();
    await service.deletePurchaseItem({...data,remark},  client);

    return `Purchase item has been deleted successfully.`;
  }
}