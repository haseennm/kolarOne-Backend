import { PoolClient } from "pg";
import { executeInTransaction, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, getTransactionCode, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { PurchaseCreateBody, PurchaseDeleteBody, PurchaseEditBody, PurchaseFetchParams } from "./purchase.types";
import StockController from "../../stock/stock.controller";
import PurchaseService from "./purchase.service";
import PurchaseItemController from "../purchaseitems/purchaseitems.controller";
// import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";
import { buildAuditChanges, emitAuditJournal } from "../../journal/journal.utils";

export default class PurchaseController {

  async purchaseCreate(data: PurchaseCreateBody) {
    const { payments, final_amount, company_id, created_by, items, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    // 1. Calculate aggregate paid_amount sum from the array
    const totalPaidAmount = payments.reduce((sum, p) => sum + (p.payment_amount ?? 0), 0);

    return transaction(async (client: PoolClient) => {
      const service = new PurchaseService();

      // Pass the calculated total and stringify the raw payment array for the database
      const purchase = await service.createPurchase(
        {
          ...rest,
          final_amount,
          remark,
          company_id,
          paid_amount: totalPaidAmount,
          payments: JSON.stringify(payments), // Storing the structured JSON array directly
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
            available_qty: item.received_qty,
            purchased_qty: item.purchased_qty,
            status: "Good",
            movement_type: "I",
            reason: getTransactionCode("purchase"),
            company_id
          },
          client
        );

        await purchaseItem.createPurchaseItem(
          {
            purchase_id: purchase.id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            status: item.status ?? "Completed",
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

      // 2. Compute party balance adjustments based on total aggregate payment
      // const party_balance_controller = new PartyBalanceController();
      const difference = totalPaidAmount - final_amount;

      if (difference !== 0) {
        const isAdvance = difference > 0;
        // await party_balance_controller.createPartyBalance(
        //   {
        //     ref_id: purchase.id,
        //     ref_type: PaymentTransactionTypeCodeMap["purchase"],
        //     created_by,
        //     balance: Math.abs(difference),
        //     flow: isAdvance ? "I" : "O",
        //     firm_id: rest.firm_id,
        //   },
        //   client
        // );
      }

      // 3. Keep inserting split records inside child ledger for transaction histories
      const payment_transactions_service = new PaymentTransactionService();
      for (const single_payment of payments) {
        if ((single_payment.payment_amount ?? 0) <= 0) continue;

        await payment_transactions_service.insertPaymentTransaction(
          {
            ref_id: purchase.id,
            amount: single_payment.payment_amount,
            ref_type: PaymentTransactionTypeCodeMap["purchase"],
            status: getStatusCode("Paid"),
            payment_method_id: single_payment.payment_method_id ?? null,
            transaction_reference: single_payment.transaction_reference ?? null,
            business_id: rest.firm_id,
            business_ref: convertEntityType("Firm" as EntityKey),
            company_id,
            payment_flow: "E"
          },
          client
        );
      }
      await emitAuditJournal({
        client,
        entityId: rest.firm_id,
        entityType: "F",
        companyId: company_id,
        tableName: "purchases",
        tableRowId: purchase.id,
        action: "create",
        record: purchase,
      });
      return `purchase ${purchase.bill_number} has been created successfully.`;
    });
  }

  async purchaseEdit(data: PurchaseEditBody) {
    const {
      final_amount,
      status,
      company_id,
      updated_by,
      items,
      delete_item_ids,
      payments = [], // ✅ Incoming array from client: { id, payment_method_id, amount, transaction_reference }
      ...rest
    } = data;

    const remark = {
      action: "Updated",
      updated_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {

      // 1. Compute total paid amount and format the JSON storage block layout exactly as requested
      const computedPaymentAmount = payments
        .filter(payment => payment.payment_flow === "E")
        .reduce((sum, payment) => sum + (payment.amount ?? 0), 0);

      const paymentsJsonStorage = payments.map(p => ({
        payment_amount: p.amount,
        payment_method_id: p.payment_method_id,
        transaction_reference: p.transaction_reference ?? ""
      }));

      // 2. Call Service to handle core table adjustments
      const service = new PurchaseService();
      const purchase = await service.editPurchase(
        {
          ...rest,
          final_amount,
          remark,
          company_id,
          computed_payment_amount: computedPaymentAmount,
          merged_payments_json: JSON.stringify(paymentsJsonStorage)
        },
        client
      );

      // 3. Handle Child Document Items
      const stockController = new StockController();
      const purchaseItem = new PurchaseItemController();
      const deletedItemIds = new Set(delete_item_ids ?? []);

      if (items?.some((item) => item.item_id && deletedItemIds.has(item.item_id))) {
        throw new AppError("Cannot edit and delete the same purchase item", 400);
      }

      if (delete_item_ids?.length) {
        for (const item_id of delete_item_ids) {
          const deletedItem = await purchaseItem.deletePurchaseItem(
            { purchase_id: purchase.data.id, firm_id: rest.firm_id, item_id },
            client
          );
          await stockController.deleteStock(
            { purchase_id: purchase.data.id, firm_id: rest.firm_id, stock_id: deletedItem.stock_id },
            client
          );
        }
      }

      const exist_items = await purchaseItem.fetchItemsOnly(client, rest.firm_id, rest.purchase_id)
      if (items) {
        const newProductIds = new Set<number>();
        for (const item of items) {
          const isNewItem = item.is_new === true || !item.item_id;
          if (isNewItem) {
            if (!item.product_id) {
              throw new AppError("Product is required to add purchase item", 400);
            }
            if (newProductIds.has(item.product_id)) {
              throw new AppError("Duplicate item in purchase edit request", 400);
            }
            newProductIds.add(item.product_id);

            await this.ensurePurchaseItemCanBeAdded(
              { purchase_id: purchase.data.id, firm_id: rest.firm_id, product_id: item.product_id },
              client
            );

            const stock = await stockController.createStock({
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              purchase_id: purchase.data.id,
              product_id: item.product_id,
              available_qty: item.received_qty!,
              purchased_qty: item.purchased_qty!,
              status: "Good",
              movement_type: "I",
              reason: getTransactionCode("purchase"),
              company_id
            }, client);

            await purchaseItem.createPurchaseItem({
              purchase_id: purchase.data.id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              status: item.status ?? status ?? "Completed",
              product_id: item.product_id,
              stock_id: stock.id,
              received_qty: item.received_qty!,
              purchased_qty: item.purchased_qty!,
              unit: item.unit!,
              unit_price: item.unit_price!,
              sub_total: item.sub_total!,
              total_igst: item.total_igst ?? 0,
              total_sgst: item.total_sgst ?? 0,
              total_cgst: item.total_cgst ?? 0,
              net_amount: item.net_amount!,
            }, client);

            continue;
          }

          const purchase_item = await purchaseItem.editPurchaseItem({
            item_id: item.item_id,
            purchase_id: purchase.data.id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            status: item.status ?? status ?? "Completed",
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
          }, client);

          await stockController.editStock({
            stock_id: purchase_item.stock_id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            company_id,
            purchase_id: purchase.data.id,
            product_id: item.product_id,
            available_qty: item.received_qty,
            purchased_qty: item.purchased_qty,
            status: "Good",
            movement_type: "I",
            reason: getTransactionCode("purchase")
          }, client);
        }
      }
      const updated_items = await purchaseItem.fetchItemsOnly(client, rest.firm_id, rest.purchase_id)
      const item_changes = buildAuditChanges(exist_items, updated_items);
      // 4. Update or Soft-Delete Payment Audit Transaction Ledgers
      const entity_type = convertEntityType("Firm" as EntityKey);
      const payment_transactions_service = new PaymentTransactionService();

      await payment_transactions_service.syncPaymentTransactions({
        ref_id: purchase.data.id,
        company_id,
        firm_id: rest.firm_id,
        statusCode: getStatusCode("Paid"), // Or customized fallback code variable
        entity_type,
        payments,
        ref_type: PaymentTransactionTypeCodeMap["purchase"]
      }, client);

      // 5. Party Balance Processing (Uses strictly updated database returned data values)
      const actualPaidAmount = Number(purchase.data.paid_amount ?? 0);
      const actualFinalAmount = Number(purchase.data.final_amount ?? 0);
      const difference = actualPaidAmount - actualFinalAmount;

      // const party_balance_controller = new PartyBalanceController();

      const isAdvance = difference > 0;
      let part_status: string;

      if (difference === 0) {
        part_status = "Paid";
      } else if (difference > 0) {
        part_status = "Advance";
      } else if (difference < 0 && actualPaidAmount > 0) {
        part_status = "Partial";
      } else {
        part_status = "Unpaid";
      }

      // await party_balance_controller.editPartyBalance(
      //   {
      //     ref_id: purchase.data.id,
      //     ref_type: PaymentTransactionTypeCodeMap["purchase"],
      //     action_by: updated_by,
      //     balance: Math.abs(difference),
      //     status: part_status,
      //     flow: !isAdvance ? "O" : "I",
      //     firm_id: rest.firm_id,
      //   },
      //   client
      // );
      await emitAuditJournal({
        client,
        entityId: rest.firm_id,
        entityType: "F",
        companyId: company_id,
        tableName: "purchases",
        tableRowId: purchase.data.id,
        action: "update",
        record: purchase.data,
        changes: {
          purchase: purchase.changes,
          "purchase items": item_changes
        },
      });
      return `purchase ${purchase.data.bill_number} has been updated successfully.`;
    });
  }
  private async ensurePurchaseItemCanBeAdded(
    data: { purchase_id: number; firm_id: number; product_id: number },
    client: PoolClient
  ) {
    const existingItem = await executeInTransaction(
      client,
      `SELECT id
       FROM purchase_items
       WHERE purchase_id = $1
       AND firm_id = $2
       AND product_id = $3
       AND status != 0
       LIMIT 1`,
      [data.purchase_id, data.firm_id, data.product_id]
    );

    if (existingItem.rows.length > 0) {
      throw new AppError("This item already exists in this purchase", 400);
    }
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
      // const partyBalanceService = new PartyBalanceController();
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
      // await partyBalanceService.deletePartyBalance(
      //   {
      //     delete_by: deleted_by, firm_id: rest.firm_id, purchase_id: rest.id
      //   },
      //   client
      // );
      await payment_transactions_service.deletePaymentTransaction({
        company_id: purchase.company_id,
        ref_id: rest.id,
        ref_type: PaymentTransactionTypeCodeMap["purchase"],
      }, client)
      await emitAuditJournal({
        client,
        entityId: rest.firm_id,
        entityType: "F",
        companyId: purchase.company_id,
        tableName: "purchases",
        tableRowId: purchase.id,
        action: "delete",
        record: purchase,
      });

      return "purchase deleted successfully"
    })
  }
}
