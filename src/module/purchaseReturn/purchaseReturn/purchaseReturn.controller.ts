import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, getTransactionCode, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { PurchaseReturnCreateBody, PurchaseReturnDeleteBody, PurchaseReturnEditBody, PurchaseReturnFetchParams } from "./purchaseReturn.types";
import StockController from "../../stock/stock.controller";
// import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";
import PurchaseReturnService from "./purchaseReturn.service";
import PurchaseReturnItemController from "../purchaseReturnItems/purchaseReturnItems.controller";
import PartyBalanceController from "../../partyBalance/partyBalance.controller";

export default class PurchaseReturnController {

  async purchaseReturnCreate(data: PurchaseReturnCreateBody) {
    const { payment_amount, final_amount, status, company_id, created_by, items, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {
      const statusCode = getStatusCode(status ?? "Completed");
      const service = new PurchaseReturnService();
      const purchase_return = await service.createPurchaseReturn(
        {
          ...rest,
          payment_amount, final_amount,
          remark,
          statusCode,
          company_id
        },
        client
      );

      const stockController = new StockController();
      const purchaseReturnItem = new PurchaseReturnItemController();
      for (const item of items) {

        const stock = await stockController.reduceStock(
          {
            stock_id: item.stock_id ?? purchase_return.stock_id,
            branch_id: rest.branch_id,
            firm_id: rest.firm_id,
            qty: item.returned_qty,
            movement_type: 'O',
            reason: getTransactionCode("purchase_return"),
            is_relate_purchase: true
          },
          client
        );
        await purchaseReturnItem.createPurchaseReturnItem(
          {
            purchase_return_id: purchase_return.id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            status: status ?? "Completed",
            product_id: item.product_id,
            stock_id: stock.id,
            returned_qty: item.returned_qty,
            unit: item.unit,
            unit_price: item.unit_price,
            sub_total: item.sub_total,
            total_igst: item.total_igst ?? 0,
            total_sgst: item.total_sgst ?? 0,
            total_cgst: item.total_cgst ?? 0,
            net_amount: item.net_amount,
            purchase_item_id: item.purchase_item_id
          },
          client
        );
      }
      // const party_balance_controller = new PartyBalanceController();
      // const difference = payment_amount - final_amount;

      // if (difference !== 0) {
      //   const isAdvance = difference > 0;

      //   await party_balance_controller.createPartyBalance(
      //     {
      //       ref_id: purchase.id,
      //       ref_type: "P",
      //       created_by,
      //       balance: Math.abs(difference),
      //       flow: isAdvance ? "O" : "I",
      //       firm_id: rest.firm_id,
      //     },
      //     client
      //   );
      // }
      const payment_transactions_service = new PaymentTransactionService()
      await payment_transactions_service.insertPaymentTransaction(
        {
          ref_id: purchase_return.id,
          amount: payment_amount,
          ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
          status: getStatusCode("Paid"),
          payment_method_id: null,
          transaction_reference: null,
          business_id: rest.firm_id,
          business_ref: convertEntityType("Firm" as EntityKey),
          company_id
        },
        client
      );

      return `purchase return ${purchase_return.return_number} has been created successfully.`;
    });
  }
  async purchaseReturnEdit(data: PurchaseReturnEditBody) {
    const { payment_amount, final_amount, status, company_id, updated_by, items, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {
      const statusCode = getStatusCode(status ?? "Completed");

      const service = new PurchaseReturnService();
      const purchase_return = await service.editPurchaseReturn(
        {
          ...rest,
          payment_amount, final_amount,
          remark,
          statusCode,
          company_id
        },
        client
      );

      const stockController = new StockController();
      const purchaseItem = new PurchaseReturnItemController();
      if (items) {
        for (const item of items) {

          const purchase_return_item = await purchaseItem.editPurchaseReturnItem(
            {
              return_item_id: item.return_item_id,
              purchase_return_id: rest.purchase_return_id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              status: status ?? "Completed",
              product_id: item.product_id,
              stock_id: item.stock_id,
              returned_qty: item.returned_qty,
              unit: item.unit,
              unit_price: item.unit_price,
              sub_total: item.sub_total,
              total_igst: item.total_igst ?? 0,
              total_sgst: item.total_sgst ?? 0,
              total_cgst: item.total_cgst ?? 0,
              net_amount: item.net_amount,
              purchase_item_id: item.purchase_item_id
            },
            client
          );
          if (item.returned_qty !== purchase_return_item.row.returned_qty) {
            await stockController.reduceStock(
              {
                stock_id: item.stock_id ?? purchase_return_item.row.stock_id,
                branch_id: rest.branch_id,
                firm_id: rest.firm_id,
                qty: item.returned_qty,
                movement_type: purchase_return_item.movement_type,
                reason: getTransactionCode("purchase_return"),
                is_relate_purchase: true
              },
              client
            );
          }
        }
      }
      const difference = (payment_amount ?? 0) - (final_amount ?? 0);
      const party_balance_controller = new PartyBalanceController();


      if (difference !== 0) {
        const isAdvance = difference > 0;

        await party_balance_controller.editPartyBalance(
          {
            ref_id: purchase_return.id,
            ref_type: "PR",
            action_by: updated_by,
            balance: Math.abs(difference),
            flow: isAdvance ? "I" : "O",
            firm_id: rest.firm_id,
          },
          client
        );
      }
      const payment_transactions_service = new PaymentTransactionService()
      await payment_transactions_service.editPaymentTransaction({
        company_id,
        amount: payment_amount,
        payment_method_id: null,
        ref_id: rest.purchase_return_id,
        ref_type: PaymentTransactionTypeCodeMap["ledger_transaction"],
        status: statusCode,
        transaction_reference: null,
        business_id: rest.firm_id,
        business_ref: "F"
      }, client)

      return `purchase return ${purchase_return.bill_number} has been created successfully.`;
    });
  }

  async purchaseReturnFetch(data: PurchaseReturnFetchParams) {
    const service = new PurchaseReturnService();
    const purchases_returnWithCode = await service.fetchReturnPurchase(data);

    const purchases_return = purchases_returnWithCode.purchaseReturns.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      purchases_return,
      pagination: { ...purchases_returnWithCode.pagination }
    };
  }
  async fullPurchaseFetch(data: PurchaseReturnFetchParams) {

    const service = new PurchaseReturnService();

    const purchasesWithCode = await service.fetchPurchaseReturnFull(data);

    const purchases = purchasesWithCode.purchaseReturns.map((row) => ({
      ...row,

      status: getStatusText(row.status),

      items: row.items?.map((item: any) => ({
        ...item,
        status: getStatusText(item.status),
      })) || [],
    }));

    return {
      purchases,
      pagination: { ...purchasesWithCode.pagination }
    };
  }
  async purchaseReturnDelete(data: PurchaseReturnDeleteBody) {
    const { deleted_by, ...rest } = data
    transaction(async (client) => {

      const remark = {
        action: `Deleted purchase return`,
        deleted_by,
        created_at: Date.now(),
      };
      const purchaseService = new PurchaseReturnService();
      const itemService = new PurchaseReturnItemController();
      const stockService = new StockController();
      // const partyBalanceService = new PartyBalanceController();
      const payment_transactions_service = new PaymentTransactionService()

      const purchase_return = await purchaseService.deletePurchaseReturn({ remark, ...rest }, client);
      await itemService.deletePurchaseItem(
        {
          purchase_id: rest.id,
          firm_id: rest.firm_id,
        },
        client
      );
      await stockService.deleteStock(
        {
          purchase_id: rest.id,
          firm_id: rest.firm_id,
        },
        client
      );
      // await partyBalanceService.deletePartyBalance(
      //   {
      //     delete_by: deleted_by, firm_id: rest.firm_id, purchase_id: rest.id
      //   },
      //   client
      // );
      payment_transactions_service.deletePaymentTransaction({
        company_id: purchase_return.company_id,
        ref_id: rest.id,
        ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
      }, client)

      return "purchase return deleted successfully"
    })
  }
}