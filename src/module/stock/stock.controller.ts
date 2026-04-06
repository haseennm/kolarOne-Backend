import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { cns, getStatusCode, getStatusText, getTransactionCode } from "../../utils/extra";
import StockService from "./stock.service";
import { StockAdditionalBody, StockChangeBody, StockCreateBody, StockDelete, StockEditBody, StockFetchParams, StockPriceSet, StockReport } from "./stock.types";
import { AppError } from "../../utils/AppError";

export default class StockController {

  async createStock(data: StockCreateBody, client: PoolClient) {
    cns("create stock", data)
    const { status, available_qty, purchased_qty, ...rest } = data;

    if (available_qty > purchased_qty) {
      throw new AppError(
        "Available quantity cannot exceed purchased quantity",
        422
      );
    }
    const statusCode = getStatusCode(status);

    const service = new StockService();

    const stock = await service.createStock(
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
  async editStock(data: StockEditBody, client: PoolClient) {
    cns("Edit stock", data)
    const { status, ...rest } = data;


    let statusCode = undefined
    if (status) {
      statusCode = getStatusCode(status);
    }
    const service = new StockService();

    const stock = await service.editStock(
      {
        ...rest,
        statusCode
      },
      client
    );

    return stock;
  }
  async reduceStock(data: StockChangeBody, client: PoolClient) {
    cns("Edit stock", data)
    const service = new StockService();

    const statusCode = getStatusCode("Good");
    const stock = await service.changeStock(
      { statusCode, ...data }
      ,
      client
    );

    return stock;
  }
  async manualStock(data: StockAdditionalBody) {
    const service = new StockService();
    const statusCode = getStatusCode("Good");
    return transaction(async (client: PoolClient) => {

      await service.createManualStock(
        {
          statusCode,
          reason: getTransactionCode("addition"),
          ...data
        }
        ,
        client
      );
    })
  }
  async setPrice(data: StockPriceSet) {
    const service = new StockService();
    return transaction(async (client: PoolClient) => {

      await service.updateSellingPrice(
        {
          ...data
        }
        ,
        client
      );
    })
  }

  async fetchStock(data: StockFetchParams) {

    const service = new StockService();

    const stocksWithCode = await service.fetchStock(data);

    const stocks = stocksWithCode.stocks.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      stocks,
      pagination: { ...stocksWithCode.pagination }
    };
  }

  async deleteStock(data: StockDelete, client: PoolClient) {
    const service = new StockService();
    await service.deleteStock(data, client);
    return `stock has been deleted successfully.`;

  }
  async reportStock(data: StockReport) {
    const service = new StockService();
    const staff = await service.getStockReportSummary(data);
    return staff
  }
}