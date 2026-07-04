import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, getTransactionCode, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { SaleReturnCreateBody, SaleReturnDeleteBody, SaleReturnEditBody, SaleReturnFetchParams } from "./saleReturn.types";
import StockController from "../../stock/stock.controller";
// import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";
import SaleReturnService from "./saleReturn.service";
import SaleReturnItemController from "../saleReturnItems/saleReturnItems.controller";
import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { AppError } from "../../../utils/AppError";

export default class SaleReturnController {

async saleReturnCreate(data: SaleReturnCreateBody) {
    const { final_amount, status, company_id, created_by, items, payments = [], ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {
      // 1. Compute multi-payment payload sums and structure JSON mapping
      const computedPaymentAmount = payments.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const paymentsJsonStorage = payments.map(p => ({
        payment_amount: p.amount,
        payment_method_id: p.payment_method_id,
        transaction_reference: p.transaction_reference ?? ""
      }));

      // 2. Persist the parent Sale Return header record
      const service = new SaleReturnService();
      const sale_return = await service.createSaleReturn(
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

      // 3. Process return line items and inventory adjustments
      const stockController = new StockController();
      const saleReturnItem = new SaleReturnItemController();
      
      for (const item of items) {
        const resolvedStockId = item.stock_id || 0;

        const stock = await stockController.reduceStock(
          {
            stock_id: resolvedStockId,
            branch_id: rest.branch_id,
            firm_id: rest.firm_id,
            qty: item.returned_qty,
            movement_type: 'I', // 'I' stands for incoming stock return
            reason: getTransactionCode("sale_return"),
            is_relate_purchase: false
          },
          client
        );

        await saleReturnItem.createSaleReturnItem(
          {
            sale_return_id: sale_return.id,
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
            sale_item_id: item.sale_item_id,
            return_mode: item.return_mode
          },
          client
        );
      }

      // 4. Record dynamic Payment Transactions using your new generic signature
      const entity_type = convertEntityType("Firm" as EntityKey);
      const payment_transactions_service = new PaymentTransactionService();

      if (payments.length > 0) {
        await payment_transactions_service.syncPaymentTransactions({
          ref_id: sale_return.id,
          ref_type: PaymentTransactionTypeCodeMap["sale_return"],
          company_id,
          firm_id: rest.firm_id,
          statusCode: getStatusCode("Paid"),
          entity_type,
          payments: payments.map(p => ({
            id: null, // Always null because they are new insert rows during create
            payment_method_id: p.payment_method_id,
            amount: p.amount,
            transaction_reference: p.transaction_reference
          }))
        }, client);
      }

      // 5. Initialize Party Balance values 
      const party_balance_controller = new PartyBalanceController();
      const difference = computedPaymentAmount - final_amount;

      const isAdvance = difference > 0;
      let part_status: string;

      if (difference === 0) {
        part_status = "Paid";
      } else if (difference > 0) {
        part_status = "Advance";
      } else if (difference < 0 && computedPaymentAmount > 0) {
        part_status = "Partial";
      } else {
        part_status = "Unpaid";
      }

      await party_balance_controller.editPartyBalance(
        {
          ref_id: sale_return.id,
          ref_type: PaymentTransactionTypeCodeMap["sale_return"],
          action_by: created_by,
          balance: Math.abs(difference),
          status: part_status,
          flow: isAdvance ? "O" : "I",
          firm_id: rest.firm_id,
        },
        client
      );

      return { 
        msg: `sale return ${sale_return.return_number} has been created successfully.`, 
        id: sale_return.id 
      };
    });
  }
  // async saleReturnCreate(data: SaleReturnCreateBody) {
  //   const { final_amount, paid_amount, status, company_id, created_by, items, ...rest } = data;

  //   const remark = {
  //     action: "Created",
  //     created_by,
  //     created_at: new Date(),
  //   };

  //   return transaction(async (client: PoolClient) => {
  //     const service = new SaleReturnService();

  //     // Save record to DB
  //     const sale_return = await service.createSaleReturn(
  //       {
  //         ...rest,
  //         final_amount,
  //         paid_amount,
  //         remark,
  //         company_id
  //       },
  //       client
  //     );

  //     const stockController = new StockController();
  //     const saleReturnItem = new SaleReturnItemController();

  //     for (const item of items) {
  //       // ✅ FIX: Use item.stock_id safely; fallback to a default tracking pool if missing
  //       const resolvedStockId = item.stock_id || 0;

  //       const stock = await stockController.reduceStock(
  //         {
  //           stock_id: resolvedStockId,
  //           branch_id: rest.branch_id,
  //           firm_id: rest.firm_id,
  //           qty: item.returned_qty,
  //           movement_type: 'I', // 'I' stands for incoming stock return
  //           reason: getTransactionCode("sale_return"),
  //           is_relate_purchase: false
  //         },
  //         client
  //       );

  //       await saleReturnItem.createSaleReturnItem(
  //         {
  //           sale_return_id: sale_return.id,
  //           firm_id: rest.firm_id,
  //           branch_id: rest.branch_id,
  //           status: status ?? "Completed",
  //           product_id: item.product_id,
  //           stock_id: stock.id, // Linked to the traced transaction log block
  //           returned_qty: item.returned_qty,
  //           unit: item.unit,
  //           unit_price: item.unit_price,
  //           sub_total: item.sub_total,
  //           total_igst: item.total_igst ?? 0,
  //           total_sgst: item.total_sgst ?? 0,
  //           total_cgst: item.total_cgst ?? 0,
  //           net_amount: item.net_amount,
  //           sale_item_id: item.sale_item_id,
  //           return_mode: item.return_mode
  //         },
  //         client
  //       );
  //     }

  //     // Adjust ledger details
  //     const party_balance_controller = new PartyBalanceController();
  //     const difference = paid_amount - final_amount;

  //     if (difference !== 0) {
  //       const isAdvance = difference > 0;

  //       await party_balance_controller.createPartyBalance(
  //         {
  //           ref_id: sale_return.id,
  //           ref_type: PaymentTransactionTypeCodeMap["sale_return"],
  //           created_by,
  //           balance: Math.abs(difference),
  //           flow: isAdvance ? "O" : "I",
  //           firm_id: rest.firm_id,
  //         },
  //         client
  //       );
  //     }

  //     // ✅ FIX: Passed real variables instead of hardcoded nulls to payment transactions table
  //     if (paid_amount > 0) {
  //       const payment_transactions_service = new PaymentTransactionService();
  //       await payment_transactions_service.insertPaymentTransaction(
  //         {
  //           ref_id: sale_return.id,
  //           amount: paid_amount, // Real money returned or processed
  //           ref_type: PaymentTransactionTypeCodeMap["sale_return"],
  //           status: getStatusCode("Paid"),
  //           payment_method_id: rest.payment_method_id ?? null,
  //           transaction_reference: rest.transaction_reference ?? null,
  //           business_id: rest.firm_id,
  //           business_ref: convertEntityType("Firm" as EntityKey),
  //           company_id,
  //           payment_flow: "E" // Expense/Outgoing cash flow 
  //         },
  //         client
  //       );
  //     }

  //     return {
  //       msg: `sale return ${sale_return.return_number} has been updated successfully.`,
  //       id: sale_return.id
  //     };
  //   });
  // }

  // async saleReturnEdit(data: SaleReturnEditBody) {
  //   const { final_amount, status, company_id, updated_by, items, ...rest } = data;

  //   const remark = {
  //     action: "Updated",
  //     updated_by,
  //     updated_at: new Date(),
  //   };

  //   return transaction(async (client: PoolClient) => {
  //     const statusCode = getStatusCode(status ?? "Completed");
  //     const service = new SaleReturnService();
  //     const sale_return = await service.editSaleReturn(
  //       {
  //         ...rest,
  //         final_amount,
  //         remark,
  //         statusCode,
  //         company_id
  //       },
  //       client
  //     );

  //     const stockController = new StockController();
  //     const saleReturnItem = new SaleReturnItemController();

  //     // ✅ Edit existing items
  //     if (items && items.length > 0) {
  //       for (const item of items) {
  //         const saleReturnItemData = await saleReturnItem.editSaleReturnItem(
  //           {
  //             item_id: item.item_id,
  //             sale_return_id: sale_return.id,
  //             firm_id: rest.firm_id,
  //             branch_id: rest.branch_id,
  //             status: status ?? "Completed",
  //             product_id: item.product_id,
  //             stock_id: item.stock_id,
  //             returned_qty: item.returned_qty,
  //             unit: item.unit,
  //             unit_price: item.unit_price,
  //             sub_total: item.sub_total,
  //             total_igst: item.total_igst,
  //             total_sgst: item.total_sgst,
  //             total_cgst: item.total_cgst,
  //             net_amount: item.net_amount,
  //             sale_item_id: item.sale_item_id,
  //             return_mode: item.return_mode
  //           },
  //           client
  //         );
  //         if (item.returned_qty !== saleReturnItemData.old_row.returned_qty) {
  //           await stockController.reduceStock(
  //             {
  //               stock_id: item.stock_id ?? saleReturnItemData.row.stock_id,
  //               branch_id: rest.branch_id,
  //               firm_id: rest.firm_id,
  //               qty: Math.abs(item.returned_qty - Number(saleReturnItemData.old_row.returned_qty)),
  //               movement_type: item.returned_qty > saleReturnItemData.old_row.returned_qty ? 'I' : 'O',
  //               reason: getTransactionCode("sale_return"),
  //               is_relate_purchase: false
  //             },
  //             client
  //           );
  //         }
  //       }
  //     }

  //     // ✅ Update payment transaction
  //     const payment_transactions_service = new PaymentTransactionService();
  //     await payment_transactions_service.editPaymentTransaction(
  //       {
  //         ref_id: sale_return.id,
  //         amount: final_amount,
  //         ref_type: PaymentTransactionTypeCodeMap["sale_return"],
  //         status: getStatusCode("Paid"),
  //         payment_method_id: null,
  //         transaction_reference: null,
  //         business_id: rest.firm_id,
  //         business_ref: convertEntityType("Firm" as EntityKey),
  //         company_id
  //       },
  //       client
  //     );

  //     return `sale return ${sale_return.return_number} has been updated successfully.`;
  //   });
  // }
  async saleReturnEdit(data: SaleReturnEditBody) {
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
      const statusCode = getStatusCode(status ?? "Completed");

      // 1. Calculate transaction sums and payment array payloads
      const computedPaymentAmount = payments.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const paymentsJsonStorage = payments.map(p => ({
        payment_amount: p.amount,
        payment_method_id: p.payment_method_id,
        transaction_reference: p.transaction_reference ?? ""
      }));

      // 2. Call Service to handle core sale return table updates
      const service = new SaleReturnService();
      const saleReturn = await service.editSaleReturn(
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

      // 3. Child Document Items & Stock Reversals Management
      const stockController = new StockController();
      const saleReturnItem = new SaleReturnItemController();
      const deletedItemIds = new Set(delete_item_ids ?? []);

      if (items?.some((item) => item.item_id && deletedItemIds.has(item.item_id))) {
        throw new AppError("Cannot edit and delete the same sale return item", 400);
      }

      // Process deletions
      if (delete_item_ids?.length) {
        for (const item_id of delete_item_ids) {
          const deletedItem = await saleReturnItem.deleteSaleItem(
            {
              sale_return_id: saleReturn.id,
              firm_id: rest.firm_id,
            },
            client
          );
          // Reverse stock incoming removal since line entry was deleted
          await stockController.reduceStock(
            {
              stock_id: deletedItem.stock_id,
              branch_id: rest.branch_id,
              firm_id: rest.firm_id,
              qty: deletedItem.returned_qty,
              movement_type: 'O', // 'I' stands for incoming stock return
              reason: getTransactionCode("sale_return"),
              is_relate_purchase: false
            },
            client
          );
        }
      }

      // Process modifications & line additions
      if (items) {
        for (const item of items) {
          const isNewItem = item.is_new === true || !item.item_id;
          if (isNewItem) {
            const resolvedStockId = item.stock_id || 0;
            const stock = await stockController.reduceStock(
              {
                stock_id: resolvedStockId,
                branch_id: rest.branch_id,
                firm_id: rest.firm_id,
                qty: item.returned_qty,
                movement_type: 'I', // Incoming stock return
                reason: getTransactionCode("sale_return"),
                is_relate_purchase: false
              },
              client
            );

            await saleReturnItem.createSaleReturnItem(
              {
                sale_return_id: saleReturn.id,
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
                sale_item_id: item.sale_item_id,
                return_mode: item.return_mode
              },
              client
            );
            continue;
          }

          // Existing items update mapping
          const updatedReturnItem = await saleReturnItem.editSaleReturnItem(
            {
              item_id: item.item_id,
              sale_return_id: saleReturn.id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              status: status ?? "Completed",
              product_id: item.product_id,
              stock_id: item.stock_id,
              returned_qty: item.returned_qty,
              unit: item.unit,
              unit_price: item.unit_price,
              sub_total: item.sub_total,
              total_igst: item.total_igst,
              total_sgst: item.total_sgst,
              total_cgst: item.total_cgst,
              net_amount: item.net_amount,
              sale_item_id: item.sale_item_id,
              return_mode: item.return_mode
            },
            client
          );

          // Update tracking pool quantities
          if (item.returned_qty !== updatedReturnItem.old_row.returned_qty) {
            await stockController.reduceStock(
              {
                stock_id: item.stock_id ?? updatedReturnItem.row.stock_id,
                branch_id: rest.branch_id,
                firm_id: rest.firm_id,
                qty: Math.abs(item.returned_qty - Number(updatedReturnItem.old_row.returned_qty)),
                movement_type: item.returned_qty > updatedReturnItem.old_row.returned_qty ? 'I' : 'O',
                reason: getTransactionCode("sale_return"),
                is_relate_purchase: false
              },
              client
            );
          }
        }
      }

      // 4. Update or Soft-Delete (status = 0) Multi-Payment Transactions 
      const entity_type = convertEntityType("Firm" as EntityKey);
      const payment_transactions_service = new PaymentTransactionService();

      await payment_transactions_service.syncPaymentTransactions({
        ref_id: saleReturn.id,
        ref_type: PaymentTransactionTypeCodeMap["sale_return"],
        company_id,
        firm_id: rest.firm_id,
        statusCode: getStatusCode("Paid"),
        entity_type,
        payments
      }, client);

      // 5. Party Balance Processing (Sale Returns usually result in cash outflow 'E')
      const actualPaidAmount = Number(saleReturn.paid_amount ?? 0);
      const actualFinalAmount = Number(saleReturn.final_amount ?? 0);
      const difference = actualPaidAmount - actualFinalAmount;

      const party_balance_controller = new PartyBalanceController();

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

      await party_balance_controller.editPartyBalance(
        {
          ref_id: saleReturn.id,
          ref_type: PaymentTransactionTypeCodeMap["sale_return"],
          action_by: updated_by,
          balance: Math.abs(difference),
          status: part_status,
          flow: isAdvance ? "O" : "I", // Maintain relative balance ledger directional flow
          firm_id: rest.firm_id,
        },
        client
      );

      return `Sale return document ${saleReturn.return_number} updated successfully.`;
    });
  }

  async saleReturnFetch(data: SaleReturnFetchParams) {
    const service = new SaleReturnService();
    const sales_returnWithCode = await service.fetchSaleReturn(data);

    const sales_return = sales_returnWithCode.sale_returns.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      sales_return,
      pagination: { ...sales_returnWithCode.pagination }
    };
  }
  async fullSaleFetch(data: SaleReturnFetchParams) {

    const service = new SaleReturnService();

    const sales_returnWithCode = await service.fetchSaleReturnFull(data);

    const sales_return = sales_returnWithCode.saleReturns.map((row) => ({
      ...row,

      status: getStatusText(row.status),

      items: row.items?.map((item: any) => ({
        ...item,
        status: getStatusText(item.status),
      })) || [],
    }));

    return {
      sales_return,
      pagination: { ...sales_returnWithCode.pagination }
    };
  }
  async saleReturnDelete(data: SaleReturnDeleteBody) {
    const { branch_id, deleted_by, ...rest } = data
    transaction(async (client) => {

      const remark = {
        action: `Deleted sale return`,
        deleted_by,
        created_at: Date.now(),
      };
      const saleReturnService = new SaleReturnService();
      const itemService = new SaleReturnItemController();
      const stockService = new StockController();
      // const partyBalanceService = new PartyBalanceController();
      const payment_transactions_service = new PaymentTransactionService()

      const saleReturn = await saleReturnService.deleteSaleReturn({ remark, ...rest }, client);
      const deleteed_item = await itemService.deleteSaleItem(
        {
          sale_return_id: rest.id,
          firm_id: rest.firm_id,
        },
        client
      );
      await stockService.reduceStock(
        {
          stock_id: deleteed_item.stock_id,
          branch_id: branch_id,
          firm_id: rest.firm_id,
          qty: deleteed_item.returned_qty,
          movement_type: 'O', // 'I' stands for incoming stock return
          reason: getTransactionCode("sale_return"),
          is_relate_purchase: false
        },
        client
      );
      // await partyBalanceService.deletePartyBalance(
      //   {
      //     delete_by: deleted_by, firm_id: rest.firm_id, sale_return_id: rest.id
      //   },
      //   client
      // );
      payment_transactions_service.deletePaymentTransaction({
        company_id: saleReturn.company_id,
        ref_id: rest.id,
        ref_type: PaymentTransactionTypeCodeMap["sale_return"],
      }, client)

      return "sale return deleted successfully"
    })
  }
}