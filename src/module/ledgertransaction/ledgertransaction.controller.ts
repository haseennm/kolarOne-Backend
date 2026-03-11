import { transaction } from "../../config/db";
import { cns, convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import LedgerTransactionService from "./ledgertransaction.service";
import { CreateLedgerTransactionBody, DeleteLedgerTransactionBody, EditLedgerTransactionBody } from "./ledgertransaction.types";

export default class LedgerTransactionController {


  async createTransaction(data: CreateLedgerTransactionBody) {

    let { created_by, status, entity_type, amount, entity_id, company_id, ...rest } = data;

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
        entity_type, amount, entity_id, company_id
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
            company_id
          },
          client
        );
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

      const transaction = await service.updateLedgerTransaction({
        ...rest,
        company_id,
        id,
        remark,
        amount,
        statusCode, entity_type, entity_id
      }, client);
      cns("transaction in edir", transaction)
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
        business_ref: entity_type
      }, client)
      return `Ledger transaction has been updated successfully.`;
    })
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