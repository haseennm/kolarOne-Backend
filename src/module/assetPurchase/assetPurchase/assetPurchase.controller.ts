import { PoolClient } from "pg";
import { executeInTransaction, transaction } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, getTransactionCode, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { AssetPurchaseCreateBody, AssetPurchaseDeleteBody, AssetPurchaseEditBody, AssetPurchaseFetchParams } from "./assetPurchase.types";

import AssetPurchaseService from "./assetPurchase.service";
// import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";
import { buildAuditChanges, emitAuditJournal } from "../../journal/journal.utils";
import AssetPurchaseItemController from "../assetPurchaseitems/assetPurchaseItems.controller";
import AssetStockController from "../../assetStock/assetStock.controller";

export default class AssetPurchaseController {

  async assetPurchaseCreate(data: AssetPurchaseCreateBody) {
    const { payments, final_amount, company_id, created_by, items, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    // 1. Calculate aggregate paid_amount sum from the array
    const totalPaidAmount = payments.reduce((sum, p) => sum + (p.payment_amount ?? 0), 0);

    return transaction(async (client: PoolClient) => {
      const service = new AssetPurchaseService();

      // Pass the calculated total and stringify the raw payment array for the database
      const purchase = await service.createAssetPurchase(
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

      const stock_Controller = new AssetStockController();
      const purchaseItem = new AssetPurchaseItemController();

      for (const item of items) {
        const stock = await stock_Controller.createAssetStock(
          {
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            asset_purchase_id: purchase.id,
            asset_product_id: item.asset_product_id,
            available_qty: item.received_qty || 1,
            purchased_qty: item.purchased_qty || 1,
            identification_number: item.identification_number,
            serial_number: item.serial_number,
            warranty_expiry: item.warranty_expiry,
            status: "Good",
            company_id
          },
          client
        );

        await purchaseItem.createPurchaseItem(
          {
            asset_purchase_id: purchase.id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            company_id,
            status: item.status ?? "Completed",
            asset_product_id: item.asset_product_id,
            asset_stock_id: stock.id,
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
      const payment_transactions_service = new PaymentTransactionService();
      let business_id;
      let business_ref;
      if (rest.firm_id) {
        business_id = rest.firm_id;
        business_ref = convertEntityType("Firm" as EntityKey)
      } else if (rest.branch_id) {
        business_id = rest.branch_id;
        business_ref = convertEntityType("Branch" as EntityKey)
      } else {
        business_id = company_id;
        business_ref = convertEntityType("Company" as EntityKey)
      }
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
            business_id: business_id,
            business_ref: business_ref,
            company_id,
            payment_flow: "E"
          },
          client
        );
      }
      await emitAuditJournal({
        client,
        entityId: business_id,
        entityType: business_ref,
        companyId: company_id,
        tableName: "asset_purchases",
        tableRowId: purchase.id,
        action: "create",
        record: purchase,
      });
      return `Asset purchase ${purchase.bill_number} has been created successfully.`;
    });
  }

  async assetPurchaseEdit(data: AssetPurchaseEditBody) {
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
      const service = new AssetPurchaseService();
      const purchase = await service.editAssetPurchase(
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
      const stock_Controller = new AssetStockController();
      const assetPurchaseItem = new AssetPurchaseItemController();
      const deletedItemIds = new Set(delete_item_ids ?? []);

      if (items?.some((item) => item.item_id && deletedItemIds.has(item.item_id))) {
        throw new AppError("Cannot edit and delete the same purchase item", 400);
      }

      if (delete_item_ids?.length) {
        for (const item_id of delete_item_ids) {
          const deletedItem = await assetPurchaseItem.deletePurchaseItem(
            { asset_purchase_id: purchase.data.id, item_id },
            client
          );
          await stock_Controller.deleteAssetStock(
            { asset_purchase_id: purchase.data.id, company_id: company_id, asset_stock_id: deletedItem.stock_id },
            client
          );
        }
      }

      const exist_items = await assetPurchaseItem.fetchItemsOnly(client, rest.asset_purchase_id)
      if (items) {
        const newProductIds = new Set<number>();
        for (const item of items) {
          const isNewItem = item.is_new === true || !item.item_id;
          if (isNewItem) {
            if (!item.asset_product_id) {
              throw new AppError("Product is required to add purchase item", 400);
            }
            if (newProductIds.has(item.asset_product_id)) {
              throw new AppError("Duplicate item in purchase edit request", 400);
            }
            newProductIds.add(item.asset_product_id);



            const stock = await stock_Controller.createAssetStock(
              {
                firm_id: rest.firm_id,
                branch_id: rest.branch_id,
                asset_purchase_id: purchase.data.id,
                asset_product_id: item.asset_product_id,
                available_qty: item.received_qty || 1,
                purchased_qty: item.purchased_qty || 1,
                identification_number: item.identification_number,
                serial_number: item.serial_number,
                warranty_expiry: item.warranty_expiry,
                status: "Good",
                company_id
              },
              client
            );

            await assetPurchaseItem.createPurchaseItem({
              company_id,
              asset_purchase_id: purchase.data.id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              status: item.status ?? status ?? "Completed",
              asset_product_id: item.asset_product_id,
              asset_stock_id: stock.id,
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

          const purchase_item = await assetPurchaseItem.editPurchaseItem({
            item_id: item.item_id,
            asset_purchase_id: purchase.data.id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            status: item.status ?? status ?? "Completed",
            asset_product_id: item.asset_product_id,
            asset_stock_id: item.asset_stock_id,
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

          await stock_Controller.editAssetStock({
            asset_stock_id: purchase_item.stock_id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            company_id,
            asset_purchase_id: purchase.data.id,
            asset_product_id: item.asset_product_id,
            available_qty: item.received_qty,
            purchased_qty: item.purchased_qty,
            status: "Good"
          }, client);
        }
      }
      const updated_items = await assetPurchaseItem.fetchItemsOnly(client, rest.asset_purchase_id)
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


      await emitAuditJournal({
        client,
        entityId: rest.firm_id,
        entityType: "F",
        companyId: company_id,
        tableName: "asset_purchases",
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

  async assetPurchaseFetch(data: AssetPurchaseFetchParams) {
    const service = new AssetPurchaseService();
    const purchasesWithCode = await service.fetchAssetPurchase(data);
    const purchases = purchasesWithCode.purchases.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));
    return {
      purchases,
      pagination: { ...purchasesWithCode.pagination }
    };
  }
  async fullAssetPurchaseFetch(data: AssetPurchaseFetchParams) {
    const service = new AssetPurchaseService();
    const purchasesWithCode = await service.fetchAssetPurchaseFull(data);
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
  async assetPurchaseDelete(data: AssetPurchaseDeleteBody) {
    const { deleted_by, ...rest } = data;

    return await transaction(async (client) => {
      const remark = {
        action: "Deleted purchase",
        deleted_by,
        created_at: Date.now(),
      };

      const AssetpurchaseService = new AssetPurchaseService();
      const itemService = new AssetPurchaseItemController();
      const stockService = new AssetStockController();
      const payment_transactions_service = new PaymentTransactionService();

      const purchase = await AssetpurchaseService.deleteAssetPurchase(
        { remark, ...rest },
        client
      );

      const purchase_item = await itemService.deletePurchaseItem(
        {
          asset_purchase_id: rest.id
        },
        client
      );

      await stockService.deleteAssetStock(
        {
          asset_purchase_id: rest.id,
          company_id: rest.company_id,
          asset_stock_id: purchase_item.id
        },
        client
      );

      await payment_transactions_service.deletePaymentTransaction(
        {
          company_id: purchase.company_id,
          ref_id: rest.id,
          ref_type: PaymentTransactionTypeCodeMap["asset_purchase"],
        },
        client
      );
      let business_id;
      let business_ref;
      if (rest.firm_id) {
        business_id = rest.firm_id;
        business_ref = convertEntityType("Firm" as EntityKey)
      } else if (rest.branch_id) {
        business_id = rest.branch_id;
        business_ref = convertEntityType("Branch" as EntityKey)
      } else {
        business_id = rest.company_id;
        business_ref = convertEntityType("Company" as EntityKey)
      }
      await emitAuditJournal({
        client,
        entityId: business_id,
        entityType: business_ref,
        companyId: purchase.company_id,
        tableName: "purchases",
        tableRowId: purchase.id,
        action: "delete",
        record: purchase,
      });

      return "purchase deleted successfully";
    });
  }
}
