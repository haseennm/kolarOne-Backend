import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, getTransactionCode, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { GetReportSalePurchaseLedger, SaleCreateBody, SaleDeleteBody, SaleEditBody, SaleFetchParams } from "./sale.types";
import StockController from "../../stock/stock.controller";
import SaleService from "./sale.service";
// import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";
import SaleItemController from "../saleItems/saleitems.controller";
import { AppError } from "../../../utils/AppError";
import QuotationController from "../../quotation/quotation/quotation.controller";
import { buildAuditChanges, emitAuditJournal } from "../../journal/journal.utils";

export default class SaleController {

  async saleCreate(data: SaleCreateBody) {
    const { final_amount, company_id, created_by, items, payments, quotation_id, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    // 1. Compute aggregate paid sum dynamically directly from incoming payment items array
    const totalPaidAmount = payments.reduce((sum, p) => sum + (p.payment_amount ?? 0), 0);

    return transaction(async (client: PoolClient) => {
      const service = new SaleService();

      // Pass aggregate paid value and stringified array down to data persistence layer
      const sale = await service.createSale(
        {
          ...rest,
          final_amount,
          remark,
          company_id,
          paid: totalPaidAmount,
          payments: JSON.stringify(payments) // Transformed array sent directly
        },
        client
      );

      const stockController = new StockController();
      const saleItem = new SaleItemController();

      for (const item of items) {
        const stock = await stockController.reduceStock(
          {
            stock_id: item.stock_id,
            branch_id: rest.branch_id,
            firm_id: rest.firm_id,
            qty: item.saled_qty,
            movement_type: 'O',
            reason: getTransactionCode("sale"),
            is_relate_purchase: false
          },
          client
        );

        await saleItem.createSaleItem({
          sale_id: sale.id,
          firm_id: rest.firm_id,
          status: "Completed",
          product_id: item.product_id,
          stock_id: stock.id,
          saled_qty: item.saled_qty,
          unit: item.unit,
          unit_price: item.unit_price,
          sub_total: item.sub_total,
          discount: item.discount ?? 0,
          total_igst: item.total_igst ?? 0,
          total_sgst: item.total_sgst ?? 0,
          total_cgst: item.total_cgst ?? 0,
          net_amount: item.net_amount,
          final_amount: item.final_amount
            ?? (item.net_amount
              - (item.discount ?? 0)
              + (item.total_igst ?? 0)
              + (item.total_sgst ?? 0)
              + (item.total_cgst ?? 0))
        }, client);
      }

      // 2. Adjust Ledger party balances against total calculated payment allocation
      // const party_balance_controller = new PartyBalanceController();
      const difference = totalPaidAmount - final_amount;

      if (difference !== 0) {
        const isAdvance = difference > 0;

        // await party_balance_controller.createPartyBalance(
        //   {
        //     ref_id: sale.id,
        //     ref_type: PaymentTransactionTypeCodeMap["sale"],
        //     created_by,
        //     balance: Math.abs(difference),
        //     flow: isAdvance ? "O" : "I",
        //     firm_id: rest.firm_id,
        //   },
        //   client
        // );
      }

      // 3. Process item history records into transactional breakdown tables
      const payment_transactions_service = new PaymentTransactionService();
      await Promise.all(
        payments.map((p) => {
          if ((p.payment_amount ?? 0) <= 0) return Promise.resolve(); // Safe skip for zero values

          return payment_transactions_service.insertPaymentTransaction(
            {
              ref_id: sale.id,
              amount: p.payment_amount,
              ref_type: PaymentTransactionTypeCodeMap["sale"],
              status: getStatusCode("Paid"),
              payment_method_id: p.payment_method_id ?? null,
              transaction_reference: p.reference ?? null,
              business_id: rest.firm_id,
              business_ref: convertEntityType("Firm" as EntityKey),
              company_id,
              payment_flow: "I"
            },
            client
          );
        })
      );
      await emitAuditJournal({
        client,
        entityId: rest.firm_id,
        entityType: "F",
        companyId: company_id,
        tableName: "sales",
        tableRowId: sale.id,
        action: "create",
        record: sale,
      });
      if (quotation_id) {
        const quotation = new QuotationController();
        await quotation.QuotationStatusChange({
          firm_id: data.firm_id,
          id: quotation_id,
          status: getStatusCode("Completed"),
          remark: {
            action: "sale done",
            sale_id: sale.id,
            updated_at: new Date(),
          }
        }, client);
      }

      return {
        msg: `Sale ${sale.invoice_number} has been created successfully.`,
        id: sale.id
      };
    });
  }
  async saleEdit(data: SaleEditBody, client?: PoolClient) {
    const saleEdit = async (
      data: SaleEditBody,
      client: PoolClient
    ): Promise<string> => {
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
      const computedPaymentAmount = payments
        .filter(payment => payment.payment_flow === "I")
        .reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
      const paymentsJsonStorage = payments.map(p => ({
        payment_amount: p.amount,
        payment_method_id: p.payment_method_id,
        transaction_reference: p.transaction_reference ?? ""
      }));

      // 2. Call Service to handle core sales table updates
      const service = new SaleService();
      const sale = await service.editSale(
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
      const saleItemController = new SaleItemController(); // Adjust name to your exact sale item class
      const deletedItemIds = new Set(delete_item_ids ?? []);

      if (items?.some((item) => item.item_id && deletedItemIds.has(item.item_id))) {
        throw new AppError("Cannot edit and delete the same sale item line", 400);
      }

      // Process line item deletions
      if (delete_item_ids?.length) {
        for (const item_id of delete_item_ids) {
          const deletedItem = await saleItemController.deleteSaleItem(
            {
              sale_id: sale.data.id,
              firm_id: rest.firm_id,
            },
            client
          );
          // Return item back to stock since sale was deleted
          await stockController.reduceStock(
            {
              stock_id: deletedItem.stock_id,
              branch_id: rest.branch_id,
              firm_id: rest.firm_id,
              qty: deletedItem.saled_qty,
              movement_type: 'I',
              reason: getTransactionCode("sale"),
              is_relate_purchase: false
            },
            client
          );
        }
      }

      // Process new and modified line items
      if (items) {
        for (const item of items) {
          const old_items = await saleItemController.fetchItemsOnly(client, rest.firm_id, rest.sale_id)
          const isNewItem = item.is_new === true || !item.item_id;
          if (isNewItem) {
            // Deduct stock for outgoing sales items
            const stock = await stockController.reduceStock(
              {
                stock_id: item.stock_id,
                branch_id: rest.branch_id,
                firm_id: rest.firm_id,
                qty: item.saled_qty,
                movement_type: 'O',
                reason: getTransactionCode("sale"),
                is_relate_purchase: false

              }, client);

            await saleItemController.createSaleItem({
              sale_id: sale.data.id,
              firm_id: rest.firm_id,
              status: "Completed",
              product_id: item.product_id,
              stock_id: stock.id,
              saled_qty: item.saled_qty,
              unit: item.unit,
              unit_price: item.unit_price,
              sub_total: item.sub_total,
              discount: item.discount ?? 0,
              total_igst: item.total_igst ?? 0,
              total_sgst: item.total_sgst ?? 0,
              total_cgst: item.total_cgst ?? 0,
              net_amount: item.net_amount,
              final_amount: item.final_amount
                ?? (item.net_amount
                  - (item.discount ?? 0)
                  + (item.total_igst ?? 0)
                  + (item.total_sgst ?? 0)
                  + (item.total_cgst ?? 0))
            }, client);

            continue;
          }
          const sale_item = await saleItemController.editSaleItem(
            {
              item_id: item.item_id,
              sale_id: sale.data.id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              status: "Completed",
              product_id: item.product_id,
              stock_id: item.stock_id,
              saled_qty: item.saled_qty,
              unit: item.unit,
              unit_price: item.unit_price,
              sub_total: item.sub_total,
              discount: item.discount ?? 0,
              total_igst: item.total_igst ?? 0,
              total_sgst: item.total_sgst ?? 0,
              total_cgst: item.total_cgst ?? 0,
              net_amount: item.net_amount,
              final_amount: item.final_amount
                ?? (item.net_amount ?? 0
                  - (item.discount ?? 0)
                  + (item.total_igst ?? 0)
                  + (item.total_sgst ?? 0)
                  + (item.total_cgst ?? 0))
            }, client);

          if (Number(item.saled_qty) !== Number(sale_item.old_row.saled_qty)) {
            await stockController.reduceStock(
              {
                stock_id: item.stock_id ?? sale_item.new_row.stock_id,
                branch_id: rest.branch_id,
                firm_id: rest.firm_id,
                qty: Math.abs(item.saled_qty - sale_item.old_row.saled_qty),
                movement_type: item.saled_qty < sale_item.old_row.saled_qty ? 'I' : 'O',
                reason: getTransactionCode("sale"),
                is_relate_purchase: false
              },
              client
            );
          }
          const updated_items = await saleItemController.fetchItemsOnly(client, rest.firm_id, rest.sale_id)
          const item_changes = buildAuditChanges(old_items, updated_items);
          await emitAuditJournal({
            client,
            entityId: rest.firm_id,
            entityType: "F",
            companyId: company_id,
            tableName: "sales",
            tableRowId: sale.data.id,
            action: "update",
            record: sale.data,
            changes: {
              "sale": sale.changes,
              "sale items": item_changes
            },
          });
        }
      }

      // 4. Invoke your Refactored Generic Payment System
      const entity_type = convertEntityType("Firm" as EntityKey);
      const payment_transactions_service = new PaymentTransactionService();

      await payment_transactions_service.syncPaymentTransactions({
        ref_id: sale.data.id,
        ref_type: PaymentTransactionTypeCodeMap["sale"], // E.g. 'S' or equivalent map value
        company_id,
        firm_id: rest.firm_id,
        statusCode: getStatusCode("Paid"),
        entity_type,
        payments
      }, client);

      // 5. Party Balance Processing (Sales bring incoming money 'I')
      const actualPaidAmount = Number(sale.data.paid ?? 0);
      const actualFinalAmount = Number(sale.data.final_amount ?? 0);
      const difference = actualPaidAmount - actualFinalAmount;

      // const party_balance_controller = new PartyBalanceController();

      // const isAdvance = difference > 0;
      // let part_status: string;

      // if (difference === 0) {
      //   part_status = "Paid";
      // } else if (difference > 0) {
      //   part_status = "Advance";
      // } else if (difference < 0 && actualPaidAmount > 0) {
      //   part_status = "Partial";
      // } else {
      //   part_status = "Unpaid";
      // }

      // await party_balance_controller.editPartyBalance(
      //   {
      //     ref_id: sale.data.id,
      //     ref_type: PaymentTransactionTypeCodeMap["sale"],
      //     action_by: updated_by,
      //     balance: Math.abs(difference),
      //     status: part_status,
      //     flow: isAdvance ? "I" : "O", // Advance collection on sales is Incoming 'I' to your balances
      //     firm_id: rest.firm_id,
      //   },
      //   client
      // );

      return `Invoice ${sale.data.invoice_number} has been updated successfully.`;
    }
    if (client) {
      return await saleEdit(data, client);
    }

    return transaction(async (client: PoolClient) => {
      return await saleEdit(data, client);
    });
  }
  // async saleEdit(data: SaleEditBody) {
  //   const { paid, final_amount, company_id, updated_by, items, payments, ...rest } = data;

  //   const remark = {
  //     action: "Updated",
  //     updated_by,
  //     updated_at: new Date(),
  //   };

  //   return transaction(async (client: PoolClient) => {

  //     const service = new SaleService();
  //     const sale = await service.editSale(
  //       {
  //         ...rest,
  //         paid,
  //         final_amount,
  //         remark,
  //         company_id,
  //         payments
  //       },
  //       client
  //     );

  //     const stockController = new StockController();
  //     const saleItem = new SaleItemController();

  //     // ✅ Edit existing items
  //     if (items && items.length > 0) {
  //       for (const item of items) {
  //         const saleItemData = await saleItem.editSaleItem(
  //           {
  //             item_id: item.item_id,
  //             sale_id: sale.id,
  //             firm_id: rest.firm_id,
  //             branch_id: rest.branch_id,
  //             status: "Completed",
  //             product_id: item.product_id,
  //             stock_id: item.stock_id,
  //             saled_qty: item.saled_qty,
  //             unit: item.unit,
  //             unit_price: item.unit_price,
  //             sub_total: item.sub_total,
  //             discount: item.discount ?? 0,
  //             total_igst: item.total_igst ?? 0,
  //             total_sgst: item.total_sgst ?? 0,
  //             total_cgst: item.total_cgst ?? 0,
  //             net_amount: item.net_amount,
  //             final_amount: item.final_amount
  //               ?? (item.net_amount ?? 0
  //                 - (item.discount ?? 0)
  //                 + (item.total_igst ?? 0)
  //                 + (item.total_sgst ?? 0)
  //                 + (item.total_cgst ?? 0))
  //           },
  //           client
  //         );
  //         if (Number(item.saled_qty) !== Number(saleItemData.old_row.saled_qty)) {
  //           await stockController.reduceStock(
  //             {
  //               stock_id: item.stock_id ?? saleItemData.new_row.stock_id,
  //               branch_id: rest.branch_id,
  //               firm_id: rest.firm_id,
  //               qty: Math.abs(item.saled_qty - saleItemData.old_row.saled_qty),
  //               movement_type: item.saled_qty < saleItemData.old_row.saled_qty ? 'I' : 'O',
  //               reason: getTransactionCode("sale"),
  //               is_relate_purchase: false
  //             },
  //             client
  //           );
  //         }
  //       }
  //     }

  //     // ✅ Update party balance if payment difference changed
  //     const party_balance_controller = new PartyBalanceController();
  //     const difference = (paid ?? sale.paid) - (final_amount ?? sale.final_amount);
  //     const payment_status = difference === paid ? "Unpaid" : "Partial"
  //     if (difference !== 0) {
  //       const isAdvance = difference > 0;

  //       await party_balance_controller.editPartyBalance(
  //         {
  //           ref_id: sale.id,
  //           ref_type: "S",
  //           action_by: updated_by,
  //           status: payment_status,
  //           balance: Math.abs(difference),
  //           flow: isAdvance ? "O" : "I",
  //           firm_id: rest.firm_id,
  //         },
  //         client
  //       );
  //     }

  //     // ✅ Update payment transactions
  //     const payment_transactions_service = new PaymentTransactionService();
  //     if (payments && payments.length > 0) {
  //       await Promise.all(
  //         payments.map((p) =>
  //           payment_transactions_service.editPaymentTransaction(
  //             {
  //               ref_id: sale.id,
  //               amount: p.amount,
  //               ref_type: PaymentTransactionTypeCodeMap["sale"],
  //               status: getStatusCode("Paid"),
  //               payment_method_id: p.payment_method_id ?? null,
  //               transaction_reference: p.reference ?? null,
  //               business_id: rest.firm_id,
  //               business_ref: convertEntityType("Firm" as EntityKey),
  //               company_id,
  //             },
  //             client
  //           )
  //         )
  //       );
  //     }

  //     return `Sale ${sale.invoice_number} has been updated successfully.`;
  //   });
  // }

  async saleFetch(data: SaleFetchParams) {

    const service = new SaleService();

    const salesWithCode = await service.fetchSale(data);

    const sales = salesWithCode.sales.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      sales,
      pagination: { ...salesWithCode.pagination }
    };
  }
  async salePurchaseReport(client: PoolClient, data: GetReportSalePurchaseLedger) {
    if (data.level === "Branch") {
      if (!data.branch_id) {
        throw new AppError("Branch id is required if level is branch", 400)
      }
    }
    if (data.level === "Firm") {
      if (!data.branch_id) {
        throw new AppError("Firm id is required if level is firm", 400)
      }
    }
    const service = new SaleService();
    const salesPurchase = await service.getSalesPurchaseReport(client, data);
    return {
      salesPurchase
    };

  }
  async fullsaleFetch(data: SaleFetchParams) {

    const service = new SaleService();

    const salesWithCode = await service.fetchSaleFull(data);

    const sales = salesWithCode.sales.map((row) => ({
      ...row,

      status: getStatusText(row.status),

      items: row.items?.map((item: any) => ({
        ...item,
        status: getStatusText(item.status),
      })) || [],
    }));

    return {
      sales,
      pagination: { ...salesWithCode.pagination }
    };
  }
  async saleDelete(data: SaleDeleteBody) {
    const { deleted_by, branch_id, ...rest } = data
    transaction(async (client) => {

      const remark = {
        action: `Deleted purchase`,
        deleted_by,
        created_at: Date.now(),
      };
      const saleService = new SaleService();
      const itemService = new SaleItemController();
      const stockController = new StockController();
      // const partyBalanceService = new PartyBalanceController();
      const payment_transactions_service = new PaymentTransactionService()

      const sale = await saleService.deleteSale({ remark, ...rest }, client);
      const sale_item = await itemService.deleteSaleItem(
        {
          sale_id: rest.id,
          firm_id: rest.firm_id,
        },
        client
      );
      await stockController.reduceStock(
        {
          stock_id: sale_item.stock_id,
          branch_id: branch_id,
          firm_id: rest.firm_id,
          qty: sale_item.saled_qty,
          movement_type: 'I',
          reason: getTransactionCode("sale"),
          is_relate_purchase: false
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
        company_id: sale.company_id,
        ref_id: rest.id,
        ref_type: PaymentTransactionTypeCodeMap["sale"],
      }, client)
      await emitAuditJournal({
        client,
        entityId: rest.firm_id,
        entityType: "F",
        companyId: sale.company_id,
        tableName: "sales",
        tableRowId: sale.id,
        action: "delete",
        record: sale,
      });
      return "Sale deleted successfully"
    })
  }

}