import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { cns, getStatusCode, getStatusText } from "../../utils/extra";
import StockService from "./stock.service";
import { StockChangeBody, StockCreateBody, StockDelete, StockEditBody, StockFetchParams } from "./stock.types";
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
}