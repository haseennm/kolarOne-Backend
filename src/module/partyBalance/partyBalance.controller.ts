import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import PartyBalanceService from "./partyBalance.service";
import { CreatePartyBalanceBody, DeletePartyBalanceBody, EditPartyBalanceBody, FetchPartyBalanceParams, RepayPartyBalanceBody } from "./partyBalance.types";

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

    // const entity_type = convertEntityType("Branch" as EntityKey);

    // const payment_transactions = new PaymentTransactionService()
    // await payment_transactions.insertPaymentTransaction({
    //   ref_id: Number(PartyBalance.id),
    //   amount: rest.PartyBalance_amount,
    //   ref_type: PaymentTransactionTypeCodeMap["PartyBalance"],
    //   status: getStatusCode("Paid"),
    //   payment_method_id: null,
    //   transaction_reference: null,
    //   business_id: rest.branch_id,
    //   business_ref: entity_type,
    //   company_id: rest.company_id
    // }, client)


    return `PartyBalance  has been created successfully.`;

  }

  async editPartyBalance(data: EditPartyBalanceBody,client:PoolClient) {

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

      const { updated_by, pay_amount, transaction_reference, payment_method_id, ...rest } = data
      const service = new PartyBalanceService();
      const remarks = {
        action: `Paid ${pay_amount}`,
        updated_by,
        updated_at: Date.now(),
      };
      const party_balance = await service.repayPartyBalance({ ...rest, remarks, pay_amount }, client);
      const entity_type = convertEntityType("Firm" as EntityKey);

      const payment_transactions = new PaymentTransactionService()
      await payment_transactions.insertPaymentTransaction({
        ref_id: Number(party_balance.id),
        amount: pay_amount,
        ref_type: PaymentTransactionTypeCodeMap["balance"],
        status: getStatusCode("Paid"),
        payment_method_id: payment_method_id ?? null,
        transaction_reference: transaction_reference ?? null,
        business_id: rest.firm_id,
        business_ref: entity_type,
        company_id: rest.company_id
      }, client)
      return `party balance has been paid successfully, Balance:'${party_balance.balance}'`;
    });
  }
  async deletePartyBalance(data: DeletePartyBalanceBody,client:PoolClient) {
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