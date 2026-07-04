import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import PartyBalanceService from "./partyBalance.service";
import { CreatePartyBalanceBody, DeletePartyBalanceBody, EditPartyBalanceBody, FetchPartyBalanceParams, RepayPartyBalanceBody } from "./partyBalance.types";
import PurchaseController from "../purchase/purchase/purchase.controller";
import PurchaseService from "../purchase/purchase/purchase.service";
import SaleService from "../sale/sale/sale.service";
import PurchaseReturnService from "../purchaseReturn/purchaseReturn/purchaseReturn.service";
import SaleReturnService from "../saleReturn/saleReturn/saleReturn.service";

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

  // async rePayPartyBalance(data: RepayPartyBalanceBody) {
  //   return transaction(async (client) => {
  //     const {
  //       updated_by,
  //       pay_amount,
  //       transaction_reference,
  //       payment_method_id,
  //       payment_amount,
  //       company_id,
  //       reference_number,
  //       ...rest
  //     } = data;
  //     const service = new PartyBalanceService();

  //     const remarks = {
  //       action: `Paid ${pay_amount}`,
  //       updated_by,
  //       updated_at: Date.now(),
  //     };

  //     const party_balance = await service.repayPartyBalance(
  //       { ...rest, remarks, pay_amount },
  //       client
  //     );

  //     const entity_type = convertEntityType("Firm" as EntityKey);

  //     const purchase_remark = {
  //       action: `Paid ${pay_amount}`,
  //       updated_by,
  //       updated_at: Date.now(),
  //     };


  //     if (rest.ref_type === "PS") {
  //       const purchase_service = new PurchaseService();
  //       await purchase_service.updatePurchasePaymentAmount({
  //         purchase_id: rest.ref_id,
  //         firm_id: rest.firm_id,
  //         remark: purchase_remark,
  //         payments: pay_amount
  //       }, client);
  //     }

  //     if (rest.ref_type === "SL") {
  //       const sale_service = new SaleService();

  //       await sale_service.updateSalePayment(
  //         {
  //           sale_id: rest.ref_id,
  //           firm_id: rest.firm_id,
  //           payments: rest.payments,
  //           remark: purchase_remark,
  //           company_id: company_id
  //         },
  //         client
  //       );
  //     }
  //     if (rest.ref_type === "PR") {
  //       const purchase_return = new PurchaseReturnService();

  //       await purchase_return.updatePurchaseReturnPaymentAmount(
  //         {
  //           purchase_return_id: rest.ref_id,
  //           firm_id: rest.firm_id,
  //           payment_amount:pay_amount,
  //           remark: purchase_remark
  //         },
  //         client
  //       );
  //     }

  //     const payment_transactions = new PaymentTransactionService();

  //     if (pay_amount > 0) {
  //       await payment_transactions.upsertPaymentTransaction({
  //         ref_id: Number(party_balance.id),
  //         amount: pay_amount, // ✅ each payment amount
  //         ref_type: party_balance.ref_type,
  //         status: getStatusCode("Paid"),
  //         payment_method_id: payment_method_id ?? null,
  //         transaction_reference: reference_number ?? null,
  //         business_id: rest.firm_id,
  //         business_ref: entity_type,
  //         company_id: company_id,
  //         payment_flow: party_balance.flow === "I" ? "I" : "E"
  //       }, client);

  //     }

  //     return `party balance has been paid successfully, Balance:'${party_balance.balance}'`;
  //   });
  // }
  async rePayPartyBalance(data: RepayPartyBalanceBody) {
    return transaction(async (client) => {
      const {
        updated_by,
        company_id,
        payments, // ✅ Destructured array for handling multiple split splits
        ...rest
      } = data;

      const service = new PartyBalanceService();

      // 1. Calculate the total aggregated payment sum from the incoming collection
      const totalPayAmount = payments.reduce((sum, p) => sum + p.payment_amount, 0);

      const remarks = {
        action: `Paid Total: ${totalPayAmount}`,
        updated_by,
        updated_at: Date.now(),
      };

      // 2. Reduce outstanding party ledger threshold balance 
      const party_balance = await service.repayPartyBalance(
        {
          ...rest,
          remarks,
          pay_amount: totalPayAmount
        },
        client
      );

      const entity_type = convertEntityType("Firm" as EntityKey);

      const base_update_remark = {
        action: `Repayment processed for total: ${totalPayAmount}`,
        updated_by,
        updated_at: Date.now(),
      };

      // ==========================================
      // 3. Route & Append To Parent Document Modules
      // ==========================================

      // Purchases ("PS")
      if (rest.ref_type === "PS") {
        const purchase_service = new PurchaseService();
        await purchase_service.updatePurchasePaymentAmount({
          purchase_id: rest.ref_id,
          firm_id: rest.firm_id,
          remark: base_update_remark,
          payments: payments, // ✅ Forwards array mapping directly 
          company_id,
          payment_flow: party_balance.flow === "I" ? "inc" : "exp"
        }, client);
      }

      // Sales ("SL")
      if (rest.ref_type === "SL") {
        const sale_service = new SaleService();
        await sale_service.updateSalePayment({
          sale_id: rest.ref_id,
          firm_id: rest.firm_id,
          payments: payments, // ✅ Matches exact uniform data structure
          remark: base_update_remark,
          company_id: company_id
        }, client);
      }

      // Purchase Returns ("PR")
      if (rest.ref_type === "PR") {
        const purchase_return = new PurchaseReturnService();
        await purchase_return.updatePurchaseReturnPaymentAmount({
          purchase_return_id: rest.ref_id,
          firm_id: rest.firm_id,
          payments: payments, // ✅ Passes array payload downstream
          remark: base_update_remark,
          company_id
        }, client);
      }

      // Sales Returns ("SR")
      if (rest.ref_type === "SR") {
        const sale_return = new SaleReturnService();
        await sale_return.updateSaleReturnPaymentAmount({
          sale_return_id: rest.ref_id,
          firm_id: rest.firm_id,
          payments: payments, // ✅ Clean integration mapping for Sales Return payments
          remark: base_update_remark,
          company_id
        }, client);
      }

      // ==========================================
      // 4. Split Itemized Audit Tracking Ledger
      // ==========================================
      const payment_transactions_service = new PaymentTransactionService();

      // Iterate across individual payments to build independent atomic audit trails
      await Promise.all(
        payments.map((p) => {
          if ((p.payment_amount ?? 0) <= 0) return Promise.resolve(); // Safety trace exit boundary Check

          return payment_transactions_service.upsertPaymentTransaction({
            ref_id: Number(party_balance.id),
            amount: p.payment_amount, // ✅ Real split threshold balance tracked atomically
            ref_type: party_balance.ref_type,
            status: getStatusCode("Paid"),
            payment_method_id: p.payment_method_id ?? null,
            transaction_reference: p.transaction_reference ?? null,
            business_id: rest.firm_id,
            business_ref: entity_type,
            company_id: company_id,
            payment_flow: party_balance.flow === "I" ? "I" : "E"
          }, client);
        })
      );

      return `party balance has been paid successfully, Balance: '${party_balance.balance}'`;
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