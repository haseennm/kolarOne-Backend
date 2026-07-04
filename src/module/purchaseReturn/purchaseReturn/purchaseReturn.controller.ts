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
import { AppError } from "../../../utils/AppError";

export default class PurchaseReturnController {

  // async purchaseReturnCreate(data: PurchaseReturnCreateBody) {
  //   const { payment_amount, final_amount, status, company_id, created_by, items, ...rest } = data;

  //   const remark = {
  //     action: "Created",
  //     created_by,
  //     created_at: new Date(),
  //   };

  //   return transaction(async (client: PoolClient) => {
  //     const statusCode = getStatusCode(status ?? "Completed");
  //     const service = new PurchaseReturnService();
  //     const purchase_return = await service.createPurchaseReturn(
  //       {
  //         ...rest,
  //         payment_amount, final_amount,
  //         remark,
  //         statusCode,
  //         company_id
  //       },
  //       client
  //     );

  //     const stockController = new StockController();
  //     const purchaseReturnItem = new PurchaseReturnItemController();
  //     for (const item of items) {

  //       const stock = await stockController.reduceStock(
  //         {
  //           stock_id: item.stock_id ?? purchase_return.stock_id,
  //           branch_id: rest.branch_id,
  //           firm_id: rest.firm_id,
  //           qty: Math.abs(item.returned_qty),

  //           movement_type: 'O',
  //           reason: getTransactionCode("purchase_return"),
  //           is_relate_purchase: true
  //         },
  //         client
  //       );
  //       await purchaseReturnItem.createPurchaseReturnItem(
  //         {
  //           purchase_return_id: purchase_return.id,
  //           firm_id: rest.firm_id,
  //           branch_id: rest.branch_id,
  //           status: status ?? "Completed",
  //           product_id: item.product_id,
  //           stock_id: stock.id,
  //           returned_qty: item.returned_qty,
  //           unit: item.unit,
  //           unit_price: item.unit_price,
  //           sub_total: item.sub_total,
  //           total_igst: item.total_igst ?? 0,
  //           total_sgst: item.total_sgst ?? 0,
  //           total_cgst: item.total_cgst ?? 0,
  //           net_amount: item.net_amount,
  //           purchase_item_id: item.purchase_item_id
  //         },
  //         client
  //       );
  //     }
  //     const party_balance_controller = new PartyBalanceController();
  //     const difference = payment_amount - final_amount;

  //     if (difference !== 0) {
  //       const isAdvance = difference > 0;

  //       await party_balance_controller.createPartyBalance(
  //         {
  //           ref_id: purchase_return.id,
  //           ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
  //           created_by,
  //           balance: Math.abs(difference),
  //           flow: isAdvance ? "O" : "I",
  //           firm_id: rest.firm_id,
  //         },
  //         client
  //       );
  //     }
  //     const payment_transactions_service = new PaymentTransactionService()
  //     await payment_transactions_service.insertPaymentTransaction(
  //       {
  //         ref_id: purchase_return.id,
  //         amount: payment_amount,
  //         ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
  //         status: getStatusCode("Paid"),
  //         payment_method_id: rest.payment_method_id ?? null,
  //         transaction_reference: rest.transaction_reference ?? null,
  //         business_id: rest.firm_id,
  //         business_ref: convertEntityType("Firm" as EntityKey),
  //         company_id,
  //         payment_flow:"I"
  //       },
  //       client
  //     );

  //     return {msg:`purchase return ${purchase_return.return_number} has been created successfully.`,id:purchase_return.id};
  //   });
  // }
  async purchaseReturnCreate(data: PurchaseReturnCreateBody) {
    const { final_amount, status, company_id, created_by, items, payments, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    // 1. Compute aggregate balance sums dynamically across split transactions collection array
    const totalPaymentAmount = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

    return transaction(async (client: PoolClient) => {
      const statusCode = getStatusCode(status ?? "Completed");
      const service = new PurchaseReturnService();

      const purchase_return = await service.createPurchaseReturn(
        {
          ...rest,
          final_amount,
          payment_amount: totalPaymentAmount,
          remark,
          statusCode,
          company_id,
          payments: JSON.stringify(payments) // Pass stringified array map down
        },
        client
      );

      const stockController = new StockController();
      const purchaseReturnItem = new PurchaseReturnItemController();

      for (const item of items) {
        // Safe dynamic resolution for items pool targeting track
        const resolvedStockId = item.stock_id || 0;

        const stock = await stockController.reduceStock(
          {
            stock_id: resolvedStockId,
            branch_id: rest.branch_id,
            firm_id: rest.firm_id,
            qty: Math.abs(item.returned_qty),
            movement_type: 'O', // Outgoing stock adjustment 
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

      // Party Balance adjustments 
      const party_balance_controller = new PartyBalanceController();
      const difference = totalPaymentAmount - final_amount;

      if (difference !== 0) {
        const isAdvance = difference > 0;

        await party_balance_controller.createPartyBalance(
          {
            ref_id: purchase_return.id,
            ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
            created_by,
            balance: Math.abs(difference),
            flow: isAdvance ? "O" : "I",
            firm_id: rest.firm_id,
          },
          client
        );
      }

      // 2. Iterate and split transactions entries tracking allocations independently
      const payment_transactions_service = new PaymentTransactionService();
      await Promise.all(
        payments.map((p) => {
          if ((p.amount ?? 0) <= 0) return Promise.resolve(); // Skip processing zero balances

          return payment_transactions_service.insertPaymentTransaction(
            {
              ref_id: purchase_return.id,
              amount: p.amount,
              ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
              status: getStatusCode("Paid"),
              payment_method_id: p.payment_method_id ?? null,
              transaction_reference: p.reference ?? null,
              business_id: rest.firm_id,
              business_ref: convertEntityType("Firm" as EntityKey),
              company_id,
              payment_flow: "I" // Income cash-flow stream direction incoming from vendor refund
            },
            client
          );
        })
      );

      return {
        msg: `purchase return ${purchase_return.return_number} has been created successfully.`,
        id: purchase_return.id
      };
    });
  }
  // async purchaseReturnEdit(data: PurchaseReturnEditBody) {
  //   const { payment_amount, final_amount, status, company_id, updated_by, items, ...rest } = data;

  //   const remark = {
  //     action: "Updated",
  //     updated_by,
  //     created_at: new Date(),
  //   };

  //   return transaction(async (client: PoolClient) => {
  //     const statusCode = getStatusCode(status ?? "Completed");

  //     const service = new PurchaseReturnService();
  //     const purchase_return = await service.editPurchaseReturn(
  //       {
  //         ...rest,
  //         payment_amount, final_amount,
  //         remark,
  //         statusCode,
  //         company_id
  //       },
  //       client
  //     );

  //     const stockController = new StockController();
  //     const purchaseItem = new PurchaseReturnItemController();
  //     if (items) {
  //       for (const item of items) {
  //         const purchase_return_item = await purchaseItem.editPurchaseReturnItem(
  //           {
  //             item_id: item.item_id,
  //             purchase_return_id: rest.purchase_return_id,
  //             firm_id: rest.firm_id,
  //             branch_id: rest.branch_id,
  //             status: status ?? "Completed",
  //             product_id: item.product_id,
  //             stock_id: item.stock_id,
  //             returned_qty: item.returned_qty,
  //             unit: item.unit,
  //             unit_price: item.unit_price,
  //             sub_total: item.sub_total,
  //             total_igst: item.total_igst ?? 0,
  //             total_sgst: item.total_sgst ?? 0,
  //             total_cgst: item.total_cgst ?? 0,
  //             net_amount: item.net_amount,
  //             purchase_item_id: item.purchase_item_id
  //           },
  //           client
  //         );
  //        if (Number(item.returned_qty) !== Number(purchase_return_item.row.returned_qty)) {
  //           await stockController.reduceStock(
  //             {
  //               stock_id: item.stock_id ?? purchase_return_item.row.stock_id,
  //               branch_id: rest.branch_id,
  //               firm_id: rest.firm_id,
  //               qty: Math.abs(item.returned_qty - purchase_return_item.existingItem.returned_qty),
  //               movement_type: purchase_return_item.movement_type,
  //               reason: getTransactionCode("purchase_return"),
  //               is_relate_purchase: true
  //             },
  //             client
  //           );
  //         }
  //       }
  //     }
  //     const difference = (payment_amount ?? 0) - (final_amount ?? 0);
  //     const party_balance_controller = new PartyBalanceController();


  //     if (difference !== 0) {
  //       const isAdvance = difference > 0;

  //       await party_balance_controller.editPartyBalance(
  //         {
  //           ref_id: purchase_return.id,
  //           ref_type: "PR",
  //           action_by: updated_by,
  //           balance: Math.abs(difference),
  //           flow: isAdvance ? "I" : "O",
  //           firm_id: rest.firm_id,
  //         },
  //         client
  //       );
  //     }
  //     const payment_transactions_service = new PaymentTransactionService()
  //     await payment_transactions_service.editPaymentTransaction({
  //       company_id,
  //       amount: payment_amount,
  //       payment_method_id: null,
  //       ref_id: rest.purchase_return_id,
  //       ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
  //       status: statusCode,
  //       transaction_reference: null,
  //       business_id: rest.firm_id,
  //       business_ref: "F"
  //     }, client)
  //     return `purchase return ${purchase_return.return_number} has been updated successfully.`;
  //   });
  // }
  async purchaseReturnEdit(data: PurchaseReturnEditBody) {
    const {
      final_amount,
      status,
      company_id,
      updated_by,
      items,
      delete_item_ids,
      payments = [],
      ...rest
    } = data;

    const remark = {
      action: "Updated",
      updated_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {

      // 1. Accumulate payment values and format structured storage matrix
      const computedPaymentAmount = payments.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const paymentsJsonStorage = payments.map(p => ({
        payment_amount: p.amount,
        payment_method_id: p.payment_method_id,
        transaction_reference: p.transaction_reference ?? ""
      }));

      // 2. Mutate state of parent return record via service layer
      const service = new PurchaseReturnService();
      const prRecord = await service.editPurchaseReturn(
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

      // 3. Handle Child Line Items & Stock Deductions
      const stockController = new StockController();
      const prItemController = new PurchaseReturnItemController(); // Adjust name to your exact item class
      const deletedItemIds = new Set(delete_item_ids ?? []);

      if (items?.some((item) => item.item_id && deletedItemIds.has(item.item_id))) {
        throw new AppError("Cannot edit and delete the same return item line", 400);
      }

      // Process deletions
      if (delete_item_ids?.length) {
        for (const item_id of delete_item_ids) {
          const deletedItem = await prItemController.deletePurchaseItem(
            {
              purchase_id: prRecord.id,
              firm_id: rest.firm_id,
            },
            client
          );
          // Reverse stock removal since line was deleted
          await stockController.deleteStock(
            {
              purchase_id: prRecord.id,
              firm_id: rest.firm_id,
            },
            client
          );
        }
      }

      // Process modifications/insertions
      if (items) {
        for (const item of items) {
          const isNewItem = item.is_new === true || !item.item_id;
          if (isNewItem) {
            // Deduct stock for return item line
            const stock = await stockController.createStock({
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              purchase_id: prRecord.purchase_id,
              product_id: item.product_id,
              available_qty: -item.return_qty!, // Negative because stock is leaving due to return
              purchased_qty: item.return_qty!,
              status: "Good",
              movement_type: "O", // Outgoing
              reason: getTransactionCode("purchase_return"),
              company_id
            }, client);

            await prItemController.createPurchaseReturnItem({
              purchase_return_id: prRecord.id,
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
            }, client);

            continue;
          }

          // Existing Item adjustment logic
          const pr_item = await prItemController.editPurchaseReturnItem(
            {
              item_id: item.item_id,
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

          await stockController.editStock({
            stock_id: pr_item.row.stock_id,
            firm_id: rest.firm_id,
            branch_id: rest.branch_id,
            company_id,
            purchase_id: prRecord.purchase_id,
            product_id: item.product_id,
            available_qty: -item.return_qty!, // Adjust delta bounds safely
            purchased_qty: item.return_qty,
            status: "Good",
            movement_type: "O",
            reason: getTransactionCode("purchase_return")
          }, client);
        }
      }

      // 4. Invoke your Refactored Generic Payment System
      const entity_type = convertEntityType("Firm" as EntityKey);
      const payment_transactions_service = new PaymentTransactionService();

      await payment_transactions_service.syncPaymentTransactions({
        ref_id: prRecord.id,
        ref_type: PaymentTransactionTypeCodeMap["purchase_return"], // Ensure this map key exists (e.g., 'PR')
        company_id,
        firm_id: rest.firm_id,
        statusCode: getStatusCode("Paid"),
        entity_type,
        payments
      }, client);

      // 5. Party Balance Reconciliation (Returns usually bring incoming cash 'I')
      const actualRefundAmount = Number(prRecord.refund_amount ?? 0);
      const actualFinalAmount = Number(prRecord.final_amount ?? 0);
      const difference = actualRefundAmount - actualFinalAmount;

      const party_balance_controller = new PartyBalanceController();

      const isAdvance = difference > 0;
      let part_status: string;

      if (difference === 0) {
        part_status = "Paid";
      } else if (difference > 0) {
        part_status = "Advance";
      } else if (difference < 0 && actualRefundAmount > 0) {
        part_status = "Partial";
      } else {
        part_status = "Unpaid";
      }

      await party_balance_controller.editPartyBalance(
        {
          ref_id: prRecord.id,
          ref_type: PaymentTransactionTypeCodeMap["purchase_return"],
          action_by: updated_by,
          balance: Math.abs(difference),
          status: part_status,
          flow: isAdvance ? "I" : "O", // Reversal matrix flow logic orientation
          firm_id: rest.firm_id,
        },
        client
      );

      return `Purchase return document ${prRecord.return_number} has been updated successfully.`;
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

    const purchase_return_withCode = await service.fetchPurchaseReturnFull(data);

    const purchase_return = purchase_return_withCode.purchaseReturns.map((row) => ({
      ...row,

      status: getStatusText(row.status),

      items: row.items?.map((item: any) => ({
        ...item,
        status: getStatusText(item.status),
      })) || [],
    }));

    return {
      purchase_return,
      pagination: { ...purchase_return_withCode.pagination }
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