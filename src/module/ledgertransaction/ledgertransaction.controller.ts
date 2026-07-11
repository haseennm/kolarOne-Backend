import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { convertEntityCode, convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import { GetReportSalePurchaseLedger } from "../sale/sale/sale.types";
import LedgerTransactionService from "./ledgertransaction.service";
import { CreateLedgerTransactionBody, DeleteLedgerTransactionBody, EditLedgerTransactionBody } from "./ledgertransaction.types";
import SaleController from "../sale/sale/sale.controller";
import { AppError } from "../../utils/AppError";
import { emitAuditJournal } from "../journal/journal.utils";

export default class LedgerTransactionController {


  async createTransaction(data: CreateLedgerTransactionBody) {

    let { created_by, status, entry_type, entity_type, amount, transaction_time = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }), entity_id, company_id, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };

    return transaction(async (client) => {

      const statusCode = getStatusCode(status);
      entity_type = convertEntityType(entity_type as EntityKey);
      const service = new LedgerTransactionService();

      const ledger_transaction = await service.createLedgerTransaction({
        ...rest,
        remark,
        statusCode,
        entity_type, amount, entity_id, company_id, transaction_time
      }, client);
      const ref_id = Number(ledger_transaction.id)

      if (ledger_transaction.status === 5) {
        const payment_transactions_service = new PaymentTransactionService()
        await payment_transactions_service.insertPaymentTransaction(
          {
            ref_id,
            amount,
            ref_type: PaymentTransactionTypeCodeMap["ledger_transaction"],
            status: statusCode,
            payment_method_id: null,
            transaction_reference: null,
            business_id: entity_id,
            business_ref: entity_type,
            company_id,
            payment_flow: entry_type
          },
          client
        );
        await emitAuditJournal({
          client,
          entityId: entity_id,
          entityType: entity_type,
          companyId: company_id,
          tableName: "ledger_transactions",
          tableRowId: ledger_transaction.id,
          action: "create",
          record: ledger_transaction,
        });
      }
      return `Ledger transaction for amount ${ledger_transaction.amount} has been created successfully.`;
    })
  }
  async editTransaction(data: EditLedgerTransactionBody) {
    const { id, updated_by, status, company_id, amount, entity_type, entity_id, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };
    return transaction(async (client) => {

      let statusCode = 99;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const service = new LedgerTransactionService();

      const ledger_transaction = await service.updateLedgerTransaction({
        ...rest,
        company_id,
        id,
        remark,
        amount,
        statusCode, entity_type, entity_id
      }, client);
      const payment_transactions_service = new PaymentTransactionService()
      await payment_transactions_service.editPaymentTransaction({
        company_id,
        amount,
        payment_method_id: null,
        ref_id: id,
        ref_type: PaymentTransactionTypeCodeMap["ledger_transaction"],
        status: statusCode,
        transaction_reference: null,
        business_id: entity_id,
        business_ref: convertEntityType(entity_type as EntityKey)
      }, client)
      await emitAuditJournal({
        client,
        entityId: entity_id,
        entityType: entity_type,
        companyId: data.company_id,
        tableName: "ledger_transactions",
        tableRowId: id,
        action: "update",
        record: ledger_transaction,
        changes:{ledger_transaction :ledger_transaction.changes},
      });
      return `Ledger transaction has been updated successfully.`;
    })
  }

  async fetchTransaction(data: any) {
    if (data.level === "company" && !data.company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (data.level === "branch" && !data.branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (data.level === "firm" && !data.firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }
    const service = new LedgerTransactionService();

    const transaction_with_code = await service.fetchLedgerTransaction(data);
    const transaction = transaction_with_code.transactions.map((row) => ({
      ...row,
      status: getStatusText(row.status),
      entity_type: convertEntityCode(row.entity_type) ?? row.entity_type
    }));

    return {
      transaction,
      pagination: { ...transaction_with_code.pagination }
    }
  }
  async fetchReportTransaction(data: GetReportSalePurchaseLedger) {
    return transaction(async (client: PoolClient) => {

      const ledger_service = new LedgerTransactionService();
      const sale_controller = new SaleController();

      const ledger = await ledger_service.getLedgerReport(client, data);
      const salesPurchaseResult = await sale_controller.salePurchaseReport(client, data);
      const salesPurchase = Array.isArray(salesPurchaseResult.salesPurchase) ? salesPurchaseResult.salesPurchase : [];
      const combined = [...salesPurchase, ...ledger];

      let total_income = 0;
      let total_expense = 0;

      combined.forEach(r => {
        const amt = Number(r.amount || 0);
        if (amt > 0) total_income += amt;
        else total_expense += Math.abs(amt);
      });

      return {
        summary: {
          total_income,
          total_expense,
          net: total_income - total_expense
        },
        data: combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };
    })
  }
  async deleteTransaction(data: DeleteLedgerTransactionBody) {
    const { deleted_by, company_id, ...rest } = data;
    return transaction(async (client) => {

      const remark = {
        action: "Deleted",
        deleted_by,
        updated_at: Date.now(),
      };

      const service = new LedgerTransactionService();

      const ledger_transaction = await service.deleteLedgerTransaction({
        ...rest,
        company_id,
        remark,
      });
      const payment_transactions_service = new PaymentTransactionService()
      await payment_transactions_service.deletePaymentTransaction({
        company_id: company_id,
        ref_id: ledger_transaction.id,
        ref_type: PaymentTransactionTypeCodeMap["ledger_transaction"],
      }, client)
      return `Ledger transaction for amount ${ledger_transaction.amount} has been deleted successfully.`;

    })
  }
}