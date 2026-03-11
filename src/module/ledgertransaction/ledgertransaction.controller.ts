import { getStatusCode, getStatusText } from "../../utils/extra";
import LedgerTransactionService from "./ledgertransaction.service";
import { CreateLedgerTransactionBody, DeleteLedgerTransactionBody, EditLedgerTransactionBody } from "./ledgertransaction.types";

export default class LedgerTransactionController {

  service = new LedgerTransactionService();

  async createTransaction(data: CreateLedgerTransactionBody) {

    let { created_by, status, entity_type, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };

    const statusCode = getStatusCode(status);
    const entityTableMap: Record<string, string> = {
      Company: "C",
      Branch: "B",
      Firm: "F"
    };

    entity_type = entityTableMap[entity_type];
    const service = new LedgerTransactionService();

    const transaction = await service.createLedgerTransaction({
      ...rest,
      remark,
      statusCode,
      entity_type
    });

    return transaction;
  }

  async fetchTransaction(data: any) {

    const service = new LedgerTransactionService();

    const transaction_with_code = await service.fetchLedgerTransaction(data);

    const transaction = transaction_with_code.transactions.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));
    return {
      transaction,
      pagination: { ...transaction_with_code.pagination }
    }
  }
  async editTransaction(data: EditLedgerTransactionBody) {

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

    const service = new LedgerTransactionService();

    const transaction = await service.updateLedgerTransaction({
      ...rest,
      remark,
      statusCode,
    });

    return transaction;
  }

  async deleteTransaction(data: DeleteLedgerTransactionBody) {
    const { deleted_by, ...rest } = data;

    const remark = {
      action: "Deleted",
      deleted_by,
      updated_at: Date.now(),
    };

    const service = new LedgerTransactionService();

    const ledger_cat = await service.deleteLedgerTransaction({
      ...rest,
      remark,
    });

    return ledger_cat;
  }
}