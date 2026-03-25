import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, getTransactionCode, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { SaleReturnCreateBody, SaleReturnDeleteBody, SaleReturnFetchParams } from "./saleReturn.types";
import StockController from "../../stock/stock.controller";
// import PartyBalanceController from "../../partyBalance/partyBalance.controller";
import { PaymentTransactionService } from "../../paymentTransaction/paymenttransaction.services";
import SaleReturnService from "./saleReturn.service";
import SaleReturnItemController from "../saleReturnItems/saleReturnItems.controller";

export default class SaleReturnController {

  async saleReturnCreate(data: SaleReturnCreateBody) {
    const { final_amount, status, company_id, created_by, items, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {
      const statusCode = getStatusCode(status ?? "Completed");
      const service = new SaleReturnService();
      const sale_return = await service.createSaleReturn(
        {
          ...rest,
          final_amount,
          remark,
          statusCode,
          company_id
        },
        client
      );

      const stockController = new StockController();
      const saleReturnItem = new SaleReturnItemController();
      for (const item of items) {

        const stock = await stockController.reduceStock(
          {
            stock_id: item.stock_id ?? sale_return.stock_id,
            branch_id: rest.branch_id,
            firm_id: rest.firm_id,
            qty: item.returned_qty,
            movement_type: 'I',
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
          ref_id: sale_return.id,
          amount: final_amount,
          ref_type: PaymentTransactionTypeCodeMap["sale_return"],
          status: getStatusCode("Paid"),
          payment_method_id: null,
          transaction_reference: null,
          business_id: rest.firm_id,
          business_ref: convertEntityType("Firm" as EntityKey),
          company_id
        },
        client
      );

      return `sale return ${sale_return.return_number} has been created successfully.`;
    });
  }
  // async purchaseEdit(data: PurchaseEditBody) {
  //   const { payment_amount, final_amount, status, company_id, updated_by, items, ...rest } = data;

  //   const remark = {
  //     action: "Updated",
  //     updated_by,
  //     created_at: new Date(),
  //   };

  //   return transaction(async (client: PoolClient) => {
  //     const statusCode = getStatusCode(status ?? "Completed");

  //     const service = new PurchaseService();
  //     const purchase = await service.editPurchase(
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
  //             reason: getTransactionCode("sale")
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

  async saleReturnFetch(data: SaleReturnFetchParams) {
    const service = new SaleReturnService();
    const salesWithCode = await service.fetchSaleReturn(data);

    const sales = salesWithCode.sale_returns.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      sales,
      pagination: { ...salesWithCode.pagination }
    };
  }
  async fullSaleFetch(data: SaleReturnFetchParams) {

    const service = new SaleReturnService();

    const salesWithCode = await service.fetchSaleReturnFull(data);

    const sales = salesWithCode.saleReturns.map((row) => ({
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
  async saleReturnDelete(data: SaleReturnDeleteBody) {
    const { deleted_by, ...rest } = data
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
      await itemService.deleteSaleItem(
        {
          sale_return_id: rest.id,
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