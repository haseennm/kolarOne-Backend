import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText, getTransactionCode } from "../../utils/extra";
import StockService from "./stock.service";
import { FetchPopup, StockAdditionalBody, StockAdjustFetchParams, StockChangeBody, StockCreateBody, StockDelete, StockEditBody, StockFetchParams, StockPriceSet, StockQtyChangeBody, StockReport } from "./stock.types";
import { AppError } from "../../utils/AppError";
import { emitAuditJournal } from "../journal/journal.utils";

export default class StockController {

  async createStock(data: StockCreateBody, client: PoolClient) {
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

      const stock = await service.createManualStock(
        {
          statusCode,
          reason: getTransactionCode("addition"),
          ...data
        }
        ,
        client
      );
      await emitAuditJournal({
        client,
        entityId: data.firm_id,
        entityType: "F",
        companyId: data.company_id,
        tableName: "stock",
        tableRowId: stock.id,
        action: "create",
        record: stock,
      });
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
  async changeQty(data: StockQtyChangeBody) {
    const service = new StockService();
    return transaction(async (client: PoolClient) => {

      const stock = await service.changeQty(
        {
          ...data
        }
        ,
        client
      );
      await emitAuditJournal({
        client,
        entityId: stock.data.firm_id,
        entityType: "F",
        companyId: data.company_id,
        tableName: "purchase_return",
        tableRowId: stock.data.id,
        action: "update",
        record: stock.data,
        changes: {
          "stock": stock.changes
        },
      });
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
  async fetchPopupStock(data: FetchPopup) {

    const service = new StockService();

    return await service.popupStock(data);



  }
  async fetchStockAdjust(data: StockAdjustFetchParams) {

    const service = new StockService();

    const stocksWithCode = await service.fetchAdjustedStock(data);

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