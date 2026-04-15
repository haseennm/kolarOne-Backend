import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import PartyBalanceService from "./partyBalance.service";
import { CreatePartyBalanceBody, DeletePartyBalanceBody, EditPartyBalanceBody, FetchPartyBalanceParams, RepayPartyBalanceBody } from "./partyBalance.types";
import PurchaseController from "../purchase/purchase/purchase.controller";
import PurchaseService from "../purchase/purchase/purchase.service";
import SaleService from "../sale/sale/sale.service";

export default class PartyBalanceController {

  async createPartyBalance(data: CreatePartyBalanceBody, client: PoolClient) {

    const { created_by, balance, ...rest } = data;

    const remark = {
      action: `Created with ${balance}`,
      created_by,
      created_at: Date.now(),
    };
    const statusCode = getStatusCode("Unpaid");

    const service = new PartyBalanceService();

    const PartyBalance = await service.createPartyBalance(
      {
        ...rest,
        statusCode,
        remark,
        balance
      },
      client
    );



    return `PartyBalance  has been created successfully.`;

  }

  async editPartyBalance(data: EditPartyBalanceBody, client: PoolClient) {

    const { status, ...rest } = data;

    let statusCode = undefined;

    if (typeof status === "string") {
      statusCode = getStatusCode(status);
    }


    const service = new PartyBalanceService();

    await service.editPartyBalance(
      {
        ...rest,
        statusCode
      },
      client
    );

    return `PartyBalance has been updated successfully.`;
  }

  async fetchPartyBalance(data: FetchPartyBalanceParams) {

    const service = new PartyBalanceService();

    const PartyBalanceesWithCode = await service.fetchPartyBalance(data);

    const PartyBalancees = PartyBalanceesWithCode.balances.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      PartyBalancees,
      pagination: { ...PartyBalanceesWithCode.pagination }
    };
  }

  async rePayPartyBalance(data: RepayPartyBalanceBody) {
    return transaction(async (client) => {
      console.log("first", data)
      const {
        updated_by,
        pay_amount,
        transaction_reference,
        payment_method_id,
        payment_amount,
        company_id,
        ...rest
      } = data;
      console.log("data", data)
      const service = new PartyBalanceService();

      const remarks = {
        action: `Paid ${pay_amount}`,
        updated_by,
        updated_at: Date.now(),
      };

      const party_balance = await service.repayPartyBalance(
        { ...rest, remarks, pay_amount },
        client
      );

      const entity_type = convertEntityType("Firm" as EntityKey);

      const purchase_remark = {
        action: `Paid ${pay_amount}`,
        updated_by,
        updated_at: Date.now(),
      };

      const total_amount = pay_amount + (payment_amount || 0);

      if (rest.ref_type === "P") {
        const purchase_service = new PurchaseService();

        await purchase_service.updatePaymentAmount({
          purchase_id: rest.ref_id,
          firm_id: rest.firm_id,
          remark: purchase_remark,
          payment_amount: total_amount
        }, client);
      }

      if (rest.ref_type === "S") {
        const sale_service = new SaleService();

        await sale_service.updateSalePayment(
          {
            sale_id: rest.ref_id,
            firm_id: rest.firm_id,
            payments: rest.payments,
            remark: purchase_remark,
            company_id: company_id
          },
          client
        );
      }

      const payment_transactions = new PaymentTransactionService();
      console.log("payment_method_id", payment_method_id)

if (rest.payments && rest.payments.length > 0) {
  for (const payment of rest.payments) {
    await payment_transactions.insertPaymentTransaction({
      ref_id: Number(party_balance.id),
      amount: payment.amount, // ✅ each payment amount
      ref_type: PaymentTransactionTypeCodeMap["balance"],
      status: getStatusCode("Paid"),
      payment_method_id: payment.payment_method_id ?? null,
      transaction_reference: payment.reference_number ?? null,
      business_id: rest.firm_id,
      business_ref: entity_type,
      company_id: company_id
    }, client);
  }
}

      return `party balance has been paid successfully, Balance:'${party_balance.balance}'`;
    });
  }
  async deletePartyBalance(data: DeletePartyBalanceBody, client: PoolClient) {
    const { delete_by, firm_id, purchase_id } = data
    const service = new PartyBalanceService();
    const remark = {
      action: "Deleted",
      delete_by,
      deleted_at: Date.now(),
    };
    await service.deletePartyBalance({ purchase_id, remark, firm_id }, client);

    return `PartyBalance has been deleted successfully.`;

  }
}