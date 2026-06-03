import { AppError } from "../../utils/AppError";
import { getStatusCode, getStatusText, isValidDateFormat } from "../../utils/extra";
import StockRentalService from "./stockRent.service";
import { CreateStockRentBody, DeleteStockRentBody, EditStockRentBody, FetchStockRentParams } from "./stockRent.types";

export default class StockRentalController {

  async fetchStockRental(data: FetchStockRentParams) {

    const service = new StockRentalService();

    const rent_stock_with_code = await service.fetchStockRental(data);

    const rent_stock = rent_stock_with_code.rent_stock.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      pagination: {
        page: rent_stock_with_code.page,
        limit: rent_stock_with_code.limit,
        total: rent_stock_with_code.total,
      },
      data: {
        rent_stock,
      },
    };
  }

async createStockRental(data: CreateStockRentBody) {
  const {
    created_by,
    status,
    is_group_item,
    unique_name,
    total_units,
    ...rest
  } = data;

  const stock_type = is_group_item ? "G" : "I";

  const remark = {
    action: "Created",
    created_by,
    created_at: Date.now(),
  };

  const statusCode = getStatusCode(status || "Good");

  if (stock_type === "I") {
    if (!unique_name?.length) {
      throw new AppError(
        "Unique names required for Individual stock",
        400
      );
    }

    if (unique_name.length !== total_units) {
      throw new AppError(
        "unique_name count must match total_units",
        400
      );
    }
  }

  const service = new StockRentalService();

  return await service.createStockRental({
    ...rest,
    remark,
    stock_type,
    statusCode,
    total_units,
    unique_name,
  });
}

  async editStockRental(data: EditStockRentBody) {

    const { updated_by, status, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };

    let statusCode;

    if (typeof status === "string") {
      statusCode = getStatusCode(status);
    }

    const service = new StockRentalService();

    const customer = await service.updateStockRental({
      ...rest,
      remark,
      statusCode,
    });

    return customer;
  }

  async deleteStockRental(data: DeleteStockRentBody) {

    const { deleted_by, ...rest } = data;

    const remark = {
      action: "Deleted",
      deleted_by,
      updated_at: Date.now(),
    };

    const service = new StockRentalService();

    const stock_rental = await service.deleteStockRental({
      ...rest,
      remark,
    });

    return stock_rental;
  }

  // async getStockRentalReport(data: GetCustomerReport) {
  //   const { ...rest } = data
  //   const hasDate =
  //     rest.start_date &&
  //     rest.end_date &&
  //     isValidDateFormat(rest.start_date) &&
  //     isValidDateFormat(rest.end_date);

  //   if ((rest.start_date || rest.end_date) && !hasDate) {
  //     throw new AppError("Invalid date format (YYYY-MM-DD)", 400)
  //   }
  //   const service = new StockRentalService();

  //   return service.getCustomerReportSummary(data);
  // }
}