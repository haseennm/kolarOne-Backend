import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { PurchaseCreateBody, PurchaseDeleteBody, PurchaseEditBody, PurchaseFetchParams } from "./purchase.types";
import StockController from "../../stock/stock.controller";
import PurchaseService from "./purchase.service";
import PurchaseItemController from "../purchaseitems/purchaseitems.controller";
import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";

export default class PurchaseController {

  async purchaseCreate(data: PurchaseCreateBody) {
    const { payment_amount, final_amount, status, company_id, created_by, items, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {
      const statusCode = getStatusCode(status ?? "Completed");

      const service = new PurchaseService();
      const purchase = await service.createPurchase(
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
      const purchaseItem = new PurchaseItemController();
      for (const item of items) {
        const stock = await stockController.createStock(
          {
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            purchase_id: purchase.id,
            product_id: item.product_id,
            selling_price: 0,
            available_qty: item.received_qty,
            purchased_qty: item.purchased_qty,
            status: "Good", // optional dynamic
            movement_type: "I",
            reason: "P",
            company_id
          },
          client
        );
        await purchaseItem.createPurchaseItem(
          {
            purchase_id: purchase.id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            status: status ?? "Completed",
            product_id: item.product_id,
            stock_id: stock.id,
            received_qty: item.received_qty,
            purchased_qty: item.purchased_qty,
            unit: item.unit,
            unit_price: item.unit_price,
            sub_total: item.sub_total,
            total_igst: item.total_igst ?? 0,
            total_sgst: item.total_sgst ?? 0,
            total_cgst: item.total_cgst ?? 0,
            net_amount: item.net_amount,
          },
          client
        );
      }
      const party_balance_controller = new PartyBalanceController();

      const difference = payment_amount - final_amount;

      if (difference !== 0) {
        const isAdvance = difference > 0;

        await party_balance_controller.createPartyBalance(
          {
            ref_id: purchase.id,
            ref_type: "P",
            created_by,
            balance: Math.abs(difference),
            flow: isAdvance ? "O" : "I",
            firm_id: rest.firm_id,
          },
          client
        );
      }
      const payment_transactions_service = new PaymentTransactionService()
      await payment_transactions_service.insertPaymentTransaction(
        {
          ref_id: purchase.id,
          amount: payment_amount,
          ref_type: PaymentTransactionTypeCodeMap["purchase"],
          status: getStatusCode("Paid"),
          payment_method_id: null,
          transaction_reference: null,
          business_id: rest.firm_id,
          business_ref: convertEntityType("Firm" as EntityKey),
          company_id
        },
        client
      );

      return `purchase ${purchase.bill_number} has been created successfully.`;
    });
  }
  async purchaseEdit(data: PurchaseEditBody) {
    const { payment_amount, final_amount, status, company_id, updated_by, items, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {
      const statusCode = getStatusCode(status ?? "Completed");

      const service = new PurchaseService();
      const purchase = await service.editPurchase(
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
      const purchaseItem = new PurchaseItemController();
      if (items) {
        for (const item of items) {

          const purchase_item = await purchaseItem.editPurchaseItem(
            {
              item_id: item.item_id, // ✅ add this
              purchase_id: purchase.id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              status: status ?? "Completed",
              product_id: item.product_id,
              stock_id: item.stock_id,
              received_qty: item.received_qty,
              purchased_qty: item.purchased_qty,
              unit: item.unit,
              unit_price: item.unit_price,
              sub_total: item.sub_total,
              total_igst: item.total_igst ?? 0,
              total_sgst: item.total_sgst ?? 0,
              total_cgst: item.total_cgst ?? 0,
              net_amount: item.net_amount,
            },
            client
          );
          const stock = await stockController.editStock(
            {
              stock_id: purchase_item.stock_id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              company_id,

              purchase_id: purchase.id,

              product_id: item.product_id,
              selling_price: 0,

              available_qty: item.received_qty,
              purchased_qty: item.purchased_qty,

              status: "Good",
              movement_type: "I",
              reason: "P"
            },
            client
          );
        }
      }
      const difference = (payment_amount ?? 0) - (final_amount ?? 0);
      const party_balance_controller = new PartyBalanceController();


      if (difference !== 0) {
        const isAdvance = difference > 0;

        await party_balance_controller.editPartyBalance(
          {
            ref_id: purchase.id,
            ref_type: "P",
            action_by: updated_by,
            balance: Math.abs(difference),
            flow: isAdvance ? "O" : "I",
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
        ref_id: rest.purchase_id,
        ref_type: PaymentTransactionTypeCodeMap["ledger_transaction"],
        status: statusCode,
        transaction_reference: null,
        business_id: rest.firm_id,
        business_ref: "F"
      }, client)

      return `purchase ${purchase.bill_number} has been created successfully.`;
    });
  }

  async purchaseFetch(data: PurchaseFetchParams) {

    const service = new PurchaseService();

    const purchasesWithCode = await service.fetchPurchase(data);

    const purchases = purchasesWithCode.purchases.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      purchases,
      pagination: { ...purchasesWithCode.pagination }
    };
  }
  async fullPurchaseFetch(data: PurchaseFetchParams) {

    const service = new PurchaseService();

    const purchasesWithCode = await service.fetchPurchaseFull(data);

    const purchases = purchasesWithCode.purchases.map((row) => ({
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
  async purchaseDelete(data: PurchaseDeleteBody) {
    const { deleted_by, ...rest } = data
    transaction(async (client) => {

      const remark = {
        action: `Deleted purchase`,
        deleted_by,
        created_at: Date.now(),
      };
      const purchaseService = new PurchaseService();
      const itemService = new PurchaseItemController();
      const stockService = new StockController();
      const partyBalanceService = new PartyBalanceController();
      const payment_transactions_service = new PaymentTransactionService()

      const purchase = await purchaseService.deletePurchase({ remark, ...rest }, client);
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
      await partyBalanceService.deletePartyBalance(
        {
          delete_by: deleted_by, firm_id: rest.firm_id, purchase_id: rest.id
        },
        client
      );
      payment_transactions_service.deletePaymentTransaction({
        company_id: purchase.company_id,
        ref_id: rest.id,
        ref_type: PaymentTransactionTypeCodeMap["purchase"],
      }, client)

      return "purchase deleted successfully"
    })
  }
}