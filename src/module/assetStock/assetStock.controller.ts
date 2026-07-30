import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText, getTransactionCode } from "../../utils/extra";
import AssetStockService from "./assetStock.service";
import { FetchPopup, AssetStockAdditionalBody, AssetStockAdjustFetchParams, AssetStockChangeBody, AssetStockCreateBody, AssetStockDelete, AssetStockEditBody, AssetStockFetchParams, AssetStockPriceSet, AssetStockQtyChangeBody, AssetStockReport } from "./assetStock.types";
import { AppError } from "../../utils/AppError";
import { emitAuditJournal } from "../journal/journal.utils";

export default class AssetStockController {

  async createAssetStock(data: AssetStockCreateBody, client: PoolClient) {
    const { status, available_qty, purchased_qty, ...rest } = data;

    if (available_qty > purchased_qty) {
      throw new AppError(
        "Available quantity cannot exceed purchased quantity",
        422
      );
    }
    const statusCode = getStatusCode(status);

    const service = new AssetStockService();

    const stock = await service.createAssetStock(
      {
        ...rest,
        purchased_qty,
        available_qty,
        statusCode
      },
      client
    );

    return stock;
  }
  async editAssetStock(data: AssetStockEditBody, client: PoolClient) {
    const { status, ...rest } = data;


    let statusCode = undefined
    if (status) {
      statusCode = getStatusCode(status);
    }
    const service = new AssetStockService();

    const stock = await service.editAssetStock(
      {
        ...rest,
        statusCode
      },
      client
    );

    return stock;
  }
  
  async deleteAssetStock(data: AssetStockDelete, client: PoolClient) {
    const service = new AssetStockService();
    await service.deleteAssetStock(data, client);
    return `stock has been deleted successfully.`;
    
  }
  // async reduceStock(data: StockChangeBody, client: PoolClient) {
  //   const service = new AssetStockService();

  //   const statusCode = getStatusCode("Good");
  //   const stock = await service.changeStock(
  //     { statusCode, ...data }
  //     ,
  //     client
  //   );

  //   return stock;
  // }
  // async manualStock(data: StockAdditionalBody) {
  //   const service = new AssetStockService();
  //   const statusCode = getStatusCode("Good");
  //   return transaction(async (client: PoolClient) => {

  //     const stock = await service.createManualStock(
  //       {
  //         statusCode,
  //         reason: getTransactionCode("addition"),
  //         ...data
  //       }
  //       ,
  //       client
  //     );
  //     await emitAuditJournal({
  //       client,
  //       entityId: data.firm_id,
  //       entityType: "F",
  //       companyId: data.company_id,
  //       tableName: "stock",
  //       tableRowId: stock.id,
  //       action: "create",
  //       record: stock,
  //     });
  //   })
  // }
  // async setPrice(data: StockPriceSet) {
  //   const service = new AssetStockService();
  //   return transaction(async (client: PoolClient) => {

  //     await service.updateSellingPrice(
  //       {
  //         ...data
  //       }
  //       ,
  //       client
  //     );
  //   })
  // }
  // async changeQty(data: StockQtyChangeBody) {
  //   const service = new AssetStockService();
  //   return transaction(async (client: PoolClient) => {

  //     const stock = await service.changeQty(
  //       {
  //         ...data
  //       }
  //       ,
  //       client
  //     );
  //     await emitAuditJournal({
  //       client,
  //       entityId: stock.data.firm_id,
  //       entityType: "F",
  //       companyId: data.company_id,
  //       tableName: "purchase_return",
  //       tableRowId: stock.data.id,
  //       action: "update",
  //       record: stock.data,
  //       changes: {
  //         "stock": stock.changes
  //       },
  //     });
  //   })
  // }

  // async fetchStock(data: StockFetchParams) {

  //   const service = new AssetStockService();

  //   const stocksWithCode = await service.fetchStock(data);

  //   const stocks = stocksWithCode.stocks.map((row) => ({
  //     ...row,
  //     status: getStatusText(row.status),
  //   }));

  //   return {
  //     stocks,
  //     pagination: { ...stocksWithCode.pagination }
  //   };
  // }
  // async fetchPopupStock(data: FetchPopup) {

  //   const service = new AssetStockService();

  //   return await service.popupStock(data);



  // }
  // async fetchStockAdjust(data: StockAdjustFetchParams) {

  //   const service = new AssetStockService();

  //   const stocksWithCode = await service.fetchAdjustedStock(data);

  //   const stocks = stocksWithCode.stocks.map((row) => ({
  //     ...row,
  //     status: getStatusText(row.status),
  //   }));

  //   return {
  //     stocks,
  //     pagination: { ...stocksWithCode.pagination }
  //   };
  // }
  // async reportStock(data: StockReport) {
  //   const service = new AssetStockService();
  //   const staff = await service.getStockReportSummary(data);
  //   return staff
  // }
}