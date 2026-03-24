import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { SaleCreateBody, SaleDeleteBody, SaleEditBody, SaleFetchParams } from "./sale.types";
import StockController from "../../stock/stock.controller";
import SaleService from "./sale.service";
import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";
import SaleItemController from "../saleItems/saleitems.controller";

export default class PurchaseController {

  async saleCreate(data: SaleCreateBody) {
    const { paid, final_amount, status, company_id, created_by, items, payments, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {
      const statusCode = getStatusCode(status ?? "Completed");

      const service = new SaleService();
      const sale = await service.createSale(
        {
          ...rest,
          paid,
          final_amount,
          remark,
          statusCode,
          company_id,
          payments
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
            reason: "PR"
          },
          client
        );
        await saleItem.createSaleItem({
          sale_id: sale.id,
          firm_id: rest.firm_id,
          status: status ?? "Completed",
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
              + (item.total_cgst ?? 0)) // added
        }, client);
      }
      const party_balance_controller = new PartyBalanceController();

      const difference = paid - final_amount;

      if (difference !== 0) {
        const isAdvance = difference > 0;

        await party_balance_controller.createPartyBalance(
          {
            ref_id: sale.id,
            ref_type: "S",
            created_by,
            balance: Math.abs(difference),
            flow: isAdvance ? "O" : "I",
            firm_id: rest.firm_id,
          },
          client
        );
      }
      const payment_transactions_service = new PaymentTransactionService()
      await Promise.all(
        payments.map((p) =>
          payment_transactions_service.insertPaymentTransaction(
            {
              ref_id: sale.id,
              amount: p.amount,
              ref_type: PaymentTransactionTypeCodeMap["sale"],
              status: getStatusCode("Paid"),
              payment_method_id: p.payment_method_id ?? null,
              transaction_reference: p.reference ?? null,
              business_id: rest.firm_id,
              business_ref: convertEntityType("Firm" as EntityKey),
              company_id,
            },
            client
          )
        )
      );

      return `purchase ${sale.invoice_number} has been created successfully.`;
    });
  }
  // async saleEdit(data: SaleEditBody) {
  //   const { payment_amount, final_amount, status, company_id, updated_by, items, ...rest } = data;

  //   const remark = {
  //     action: "Updated",
  //     updated_by,
  //     created_at: new Date(),
  //   };

  //   return transaction(async (client: PoolClient) => {
  //     const statusCode = getStatusCode(status ?? "Completed");

  //     const service = new SaleService();
  //     const purchase = await service.editSale(
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
  //     const purchaseItem = new PurchaseItemController();
  //     if (items) {
  //       for (const item of items) {

  //         const purchase_item = await purchaseItem.editPurchaseItem(
  //           {
  //             item_id: item.item_id, // ✅ add this
  //             purchase_id: purchase.id,
  //             firm_id: rest.firm_id,
  //             branch_id: rest.branch_id,
  //             status: status ?? "Completed",
  //             product_id: item.product_id,
  //             stock_id: item.stock_id,
  //             received_qty: item.received_qty,
  //             purchased_qty: item.purchased_qty,
  //             unit: item.unit,
  //             unit_price: item.unit_price,
  //             sub_total: item.sub_total,
  //             total_igst: item.total_igst ?? 0,
  //             total_sgst: item.total_sgst ?? 0,
  //             total_cgst: item.total_cgst ?? 0,
  //             net_amount: item.net_amount,
  //           },
  //           client
  //         );
  //         const stock = await stockController.editStock(
  //           {
  //             stock_id: purchase_item.stock_id,
  //             firm_id: rest.firm_id,
  //             branch_id: rest.branch_id,
  //             company_id,

  //             purchase_id: purchase.id,

  //             product_id: item.product_id,
  //             selling_price: 0,

  //             available_qty: item.received_qty,
  //             purchased_qty: item.purchased_qty,

  //             status: "Good",
  //             movement_type: "I",
  //             reason: "P"
  //           },
  //           client
  //         );
  //       }
  //     }
  //     const difference = (payment_amount ?? 0) - (final_amount ?? 0);
  //     const party_balance_controller = new PartyBalanceController();


  //     if (difference !== 0) {
  //       const isAdvance = difference > 0;

  //       await party_balance_controller.editPartyBalance(
  //         {
  //           ref_id: purchase.id,
  //           ref_type: "P",
  //           action_by: updated_by,
  //           balance: Math.abs(difference),
  //           flow: isAdvance ? "O" : "I",
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
  //       ref_id: rest.purchase_id,
  //       ref_type: PaymentTransactionTypeCodeMap["ledger_transaction"],
  //       status: statusCode,
  //       transaction_reference: null,
  //       business_id: rest.firm_id,
  //       business_ref: "F"
  //     }, client)

  //     return `purchase ${purchase.bill_number} has been created successfully.`;
  //   });
  // }

  async saleFetch(data: SaleFetchParams) {

    const service = new SaleService();

    const purchasesWithCode = await service.fetchSale(data);

    const purchases = purchasesWithCode.sales.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      purchases,
      pagination: { ...purchasesWithCode.pagination }
    };
  }
  async fullsaleFetch(data: SaleFetchParams) {

    const service = new SaleService();

    const purchasesWithCode = await service.fetchSaleFull(data);

    const purchases = purchasesWithCode.sales.map((row) => ({
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
  async saleDelete(data: SaleDeleteBody) {
    const { deleted_by,branch_id, ...rest } = data
    transaction(async (client) => {

      const remark = {
        action: `Deleted purchase`,
        deleted_by,
        created_at: Date.now(),
      };
      const saleService = new SaleService();
      const itemService = new SaleItemController();
      const stockController = new StockController();
      const partyBalanceService = new PartyBalanceController();
      const payment_transactions_service = new PaymentTransactionService()

      const sale = await saleService.deleteSale({ remark, ...rest }, client);
      const sale_item =await itemService.deleteSaleItem(
        {
          sale_id: rest.id,
          firm_id: rest.firm_id,
        },
        client
      );
      await stockController.reduceStock(
          {
            stock_id: sale_item.stock_id,
            branch_id:branch_id,
            firm_id: rest.firm_id,
            qty: sale_item.saled_qty,
            movement_type: 'I',
            reason: "SR"
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
        company_id: sale.company_id,
        ref_id: rest.id,
        ref_type: PaymentTransactionTypeCodeMap["sale"],
      }, client)

      return "Sale deleted successfully"
    })
  }
}