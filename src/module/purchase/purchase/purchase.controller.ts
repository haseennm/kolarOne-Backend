import { PoolClient } from "pg";
import { transaction } from "../../../config/db";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../../utils/extra";
import { PurchaseCreateBody, PurchaseFetchParams } from "./purchase.types";
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
          ref_type: PaymentTransactionTypeCodeMap["sale"],
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
  // async editRole(data: EditRoleBody) {

  //   const { status, ...rest } = data;

  //   return transaction(async (client) => {

  //     let statusCode = 99;

  //     if (typeof status === "string") {
  //       statusCode = getStatusCode(status);
  //     }

  //     const service = new RoleService();

  //     await service.updateRole(
  //       {
  //         ...rest,
  //         statusCode
  //       },
  //       client
  //     );

  //     return `Role has been updated successfully.`;
  //   });
  // }

  // async fetchRole(data: FetchRoleParams) {

  //   const service = new RoleService();

  //   const rolesWithCode = await service.fetchRole(data);

  //   const roles = rolesWithCode.roles.map((row) => ({
  //     ...row,
  //     status: getStatusText(row.status),
  //   }));

  //   return {
  //     roles,
  //     pagination: { ...rolesWithCode.pagination }
  //   };
  // }

  // async deleteRole(data: DeleteRoleBody) {

  //   return transaction(async () => {

  //     const service = new RoleService();

  //     const role = await service.deleteRole(data);

  //     return `Role ${role.role} has been deleted successfully.`;
  //   });
  // }
}