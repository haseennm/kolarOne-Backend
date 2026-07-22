import { PoolClient } from "pg";
import { BulkEditPaymentRequest, GetPaymentTransactions, GetPaymentTransactionsRequest, PaymentRow } from "./paymenttransaction.types";
import { PaymentTransactionService } from "./paymenttransaction.services";
import { getStatusText, PaymentTransactionCodeTypeMap, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { transaction } from "../../config/db";

export default class PaymentTransactionController {
  async editPayment(data: BulkEditPaymentRequest) {
    const service = new PaymentTransactionService();
    // const sale_controller = new SaleController();

    return transaction(async (client: PoolClient) => {
      return await service.editPaymentTransactions(data, client);

    });
  }
  async fetchPayment(data: GetPaymentTransactionsRequest) {
    const {
      page = 1,
      limit = 10,
      ref_type,
      ...filters
    } = data;

    // paymenttransaction.controller.ts

    const service = new PaymentTransactionService();

    const paymentsWithCode = await service.fetchPayments({
      offset: (page - 1) * limit,
      filters: {
        ...filters,
        //   Convert each element of the array into its short DB code mapping
        ref_type: ref_type ? ref_type.map(type => PaymentTransactionTypeCodeMap[type]) : [],
        page,
        limit,
      },
    });

    const payments = (paymentsWithCode.payments as PaymentRow[]).map((row) => ({
      ...row,
      status: getStatusText(row.status),
      ref_type: PaymentTransactionCodeTypeMap[row.ref_type],
    }));

    return {
      payments,
      pagination: paymentsWithCode.pagination,
    };
  }
}
