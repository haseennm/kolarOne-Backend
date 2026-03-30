import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { convertEntityType, EntityKey, getStatusCode, getStatusText } from "../../utils/extra";
import FinancialYearService from "./financialYear.service";
import {
  CreateFinancialYearBody,
  DeleteFinancialYearBody,
  EditFinancialYearBody,
  FetchFinancialYearParams
} from "./financialYear.types";

export default class FinancialYearController {

  async createFinancialYear(data: CreateFinancialYearBody) {
    const { status, entity_type, from_date, end_date, created_by, ...rest } = data;

    // Convert to Date
    const start = new Date(from_date);
    const end = new Date(end_date);

    // Check valid date format
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
    }

    // Check order
    if (start > end) {
      throw new AppError("from_date cannot be greater than end_date", 400);
    }

    return transaction(async (client) => {
      const statusCode = getStatusCode(status);

      // convert once, don't mutate original
      const entityCode = convertEntityType(entity_type);

      const service = new FinancialYearService();
      const remark = {
        action: "Created",
        created_by,
        created_at: Date.now(),
      };
      const financialYear = await service.createFinancialYear(
        {
          ...rest,
          statusCode,
          remark,
          end_date, from_date,
          entity_type: entityCode, // now "C" | "B" | "F"
        },
        client
      );

      return `FinancialYear ${financialYear.FinancialYear} has been created successfully.`;
    });
  }

  async editFinancialYear(data: EditFinancialYearBody) {

    const { status, updated_by, ...rest } = data;

    return transaction(async (client) => {

      let statusCode = 99;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }
      const remark = {
        action: "Updated",
        updated_by,
        created_at: Date.now(),
      };

      const service = new FinancialYearService();

      await service.updateFinancialYear(
        {
          ...rest,
          statusCode,
          remark
        },
        client
      );

      return `FinancialYear has been updated successfully.`;
    });
  }

  async fetchFinancialYear(data: FetchFinancialYearParams) {

    const service = new FinancialYearService();

    const FinancialYearsWithCode = await service.fetchFinancialYear(data);

    const FinancialYears = FinancialYearsWithCode.financialYears.map((row) => ({
      ...row,
      status: getStatusText(row.status)

    }));

    return {
      FinancialYears,
      pagination: { ...FinancialYearsWithCode.pagination }
    };
  }

  async deleteFinancialYear(data: DeleteFinancialYearBody) {

    return transaction(async () => {

      const service = new FinancialYearService();

      const FinancialYear = await service.deleteFinancialYear(data);

      return `Financial year  has been deleted successfully.`;
    });
  }
}