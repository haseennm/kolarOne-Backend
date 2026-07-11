import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
import FinancialYearService from "./financialYear.service";
import {
  CreateFinancialYearBody,
  DeleteFinancialYearBody,
  EditFinancialYearBody,
  FetchFinancialYearParams
} from "./financialYear.types";

export default class FinancialYearController {

  async createFinancialYear(data: CreateFinancialYearBody) {
    const { status, from_date, end_date, created_by, ...rest } = data;
    const start = new Date(from_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
    }
    if (start > end) {
      throw new AppError("from_date cannot be greater than end_date", 400);
    }

    return transaction(async (client) => {
      const statusCode = getStatusCode(status);


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
        },
        client
      );

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "financial_year",
        tableRowId: financialYear.id,
        action: "create",
        record: financialYear,
      });

      return financialYear;
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

      const result = await service.updateFinancialYear(
        {
          ...rest,
          statusCode,
          remark
        },
        client
      );

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "financial_year",
        tableRowId: result.id,
        action: "update",
        record: result,
        changes: result.changes,
      });

      return result;
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

    return transaction(async (client) => {

      const service = new FinancialYearService();

      const financialYear = await service.deleteFinancialYear(data, client);

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "financial_year",
        tableRowId: financialYear.id,
        action: "delete",
        record: financialYear,
      });

      return financialYear;
    });
  }
}