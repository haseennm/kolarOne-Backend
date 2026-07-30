import { PoolClient } from "pg";
import { getStatusCode, getStatusText } from "../../../utils/extra";
import { CreateAssetPurchaseItemBody, DeleteAssetPurchaseItemBody, EditAssetPurchaseItemBody, FetchAssetPurchaseItemParams } from "./assetPurchaseItems.types";
import AssetPurchaseItemService from "./assetPurchaseItems.service";
import { AppError } from "../../../utils/AppError";

export default class AssetPurchaseItemController {

  async createPurchaseItem(data: CreateAssetPurchaseItemBody, client: PoolClient) {
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
    const service = new AssetPurchaseItemService();

    await service.createAssetPurchaseItems(
      {
        ...rest,
        statusCode,
        remark
      },
      client
    );


    return `purchaseItem has been created successfully.`;
  }
  async editPurchaseItem(data: EditAssetPurchaseItemBody, client: PoolClient) {
    const { status, ...rest } = data;

    let statusCode = undefined
    if (status) statusCode = getStatusCode(status);

    const remark = {
      action: "Update",
      created_at: Date.now(),
    }
    const { item_id } = rest;
    if (!item_id) {
      throw new AppError("Purchase item id is required", 400);
    }

    const service = new AssetPurchaseItemService();

    const purchase_item = service.updateAssetPurchaseItem(
      {
        ...rest,
        item_id,
        statusCode,
        remark
      },
      client
    );


    return purchase_item;
  }
  async fetchPurchaseItems(data: FetchAssetPurchaseItemParams) {

    const service = new AssetPurchaseItemService();

    const rolesWithCode = await service.fetchAssetPurchaseItems(data);

    const roles = rolesWithCode.items.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      roles,
      pagination: { ...rolesWithCode.pagination }
    };
  }

  async fetchItemsOnly(client: PoolClient, asset_purchase_id: number) {
    const service = new AssetPurchaseItemService();
    const items = service.fetchAssetItemsOnly(client, asset_purchase_id)
    return items
  }


  async deletePurchaseItem(data: DeleteAssetPurchaseItemBody, client: PoolClient) {
    const remark = {
      action: "Deleted",
      deleted_at: Date.now(),
    };
    const service = new AssetPurchaseItemService();
    const deletedItem = await service.deleteAssetPurchaseItem({ ...data, remark }, client);

    return deletedItem;
  }
}
