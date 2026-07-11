import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
import LedgerCategoryService from "./ledgerCategory.service";
import { CreateLedgerCategoryBody, DeleteLedgerCategoryBody, EditLedgerCategoryBody } from "./ledgerCategory.types";

export default class LedgerCategoryController {

  service = new LedgerCategoryService();

  async createCategory(data: CreateLedgerCategoryBody) {
    const result = transaction(async (client) => {

      const { created_by, status, ...rest } = data;

      const remark = {
        action: "Created",
        created_by,
        created_at: Date.now(),
      };

      const statusCode = getStatusCode(status);

      const service = new LedgerCategoryService();

      const category = await service.createLedgerCategory({
        ...rest,
        remark,
        statusCode,
      }, client);
      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: rest.company_id,
        tableName: "ledger_categories",
        tableRowId: category.id,
        action: "create",
        record: category,
      });
      return category;
    })
  }

  async fetchCategory(data: any) {

    const service = new LedgerCategoryService();

    const category_with_code = await service.fetchLedgerCategory(data);

    const category = category_with_code.categories.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));
    return {
      category,
      pagination: { ...category_with_code.pagination }
    }
  }

  async editCategory(data: EditLedgerCategoryBody) {
    const result = transaction(async (client) => {
      const { updated_by, status, ...rest } = data;
      const remark = {
        action: "Updated",
        updated_by,
        updated_at: Date.now(),
      };

      let statusCode = 99;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const service = new LedgerCategoryService();

      const category = await service.updateLedgerCategory({
        ...rest,
        remark,
        statusCode,
      }, client);

      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: rest.company_id,
        tableName: "firm",
        tableRowId: category.data.id,
        action: "update",
        record: category.data,
        changes: { "ledger category": category.changes }
      });
      return category;
    })
    return result

  }

  async deleteCategory(data: DeleteLedgerCategoryBody) {
    const { deleted_by, ...rest } = data;
    const result = transaction(async (client) => {
      const remark = {
        action: "Deleted",
        deleted_by,
        updated_at: Date.now(),
      };

      const service = new LedgerCategoryService();

      const ledger_cat = await service.deleteLedgerCategory({
        ...rest,
        remark,
      }, client);

      await emitAuditJournal({
        client,
        entityId: rest.company_id,
        entityType: "C",
        companyId: ledger_cat.company_id,
        tableName: "ledger_categories",
        tableRowId: ledger_cat.id,
        action: "delete",
        record: ledger_cat,
      });[]
      return ledger_cat;
    })
    return result
  }
}