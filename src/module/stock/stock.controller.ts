import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { cns, getStatusCode, getStatusText } from "../../utils/extra";
import StockService from "./stock.service";
import { StockCreateBody, StockDelete, StockFetchParams } from "./stock.types";
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

  // async editRole(data: EditRoleBody) {

  //   const { status, ...rest } = data;

  //   return transaction(async (client) => {

  //     let statusCode = 99;

  //     if (typeof status === "string") {
  //       statusCode = getStatusCode(status);
  //     }

  //     const service = new StockService();

  //     await service.updateRole(
  //       {
  //         ...rest,
  //         statusCode
  //       },
  //       client
  //     );

  //     return `Role has been updated successfully.`;
  //   });
  // }

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

  async deleteRole(data: StockDelete, client: PoolClient) {
    const service = new StockService();
    await service.deleteStock(data, client);
    return `stock has been deleted successfully.`;

  }
}