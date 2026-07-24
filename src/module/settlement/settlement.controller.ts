import { PoolClient } from "pg";
import { transaction } from "../../config/db";
import { billStatus, convertEntityType, EntityKey, getStatusCode, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import SettlementService from "./settlement.service";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import { PurchaseSettlementSyncBody, SaleSettlementSyncBody } from "./settlement.types";
import { AppError } from "../../utils/AppError";


export default class SettlementController {

  // 1. GET Function: Fetch remaining amounts for the frontend screen
  async fetchRemainingAmounts(data: { firm_id: number, is_purchase: boolean }) {
    const service = new SettlementService();
    if (data.is_purchase === true) return await service.getVendorBalances(data.firm_id);
    if (data.is_purchase === false) return await service.getCustomerBalances(data.firm_id);
  }
  async syncPurchaseAndReturn(data: PurchaseSettlementSyncBody) {
    const {
      firm_id,
      company_id,
      purchase_id,
      purchase_return_id,
      payments,
      updated_by
    } = data;
    if (!purchase_id && !purchase_return_id) {

      throw new AppError("You must provide either a purchase_id or a purchase_return_id to process a settlement.", 400);

    }
    return transaction(async (client: PoolClient) => {
      const ptService = new PaymentTransactionService();
      const timestamp = Date.now();
      const totalExternalPayment = payments.reduce((sum, p) => sum + Number(p.payment_amount), 0);
      let purchase: any = null;
      let purchaseReturn: any = null;
      // 1. Row Locking Fetch Operations
      if (purchase_id) {
        const pRes = await client.query(
          `SELECT id, final_amount, paid_amount, remarks FROM purchases WHERE id = $1 AND firm_id = $2 AND status != $3 FOR UPDATE`,
          [purchase_id, firm_id, getStatusCode("Deleted")]
        );
        if (pRes.rows.length > 0) purchase = pRes.rows[0];
      }
      if (purchase_return_id) {
        const prRes = await client.query(
          `SELECT id, final_amount, refund_amount, remarks FROM purchase_return WHERE id = $1 AND firm_id = $2 AND status != $3 FOR UPDATE`,
          [purchase_return_id, firm_id, getStatusCode("Deleted")]
        );
        if (prRes.rows.length > 0) purchaseReturn = prRes.rows[0];
      }
      let currentPurchaseDue = purchase ? (Number(purchase.final_amount) - Number(purchase.paid_amount)) : 0;
      let currentReturnDue = purchaseReturn ? -(Number(purchaseReturn.final_amount) - Number(purchaseReturn.refund_amount)) : 0;
      const parseRemarks = (remarkField: any) => {
        if (!remarkField) return [];
        if (Array.isArray(remarkField)) return remarkField;
        try { return JSON.parse(remarkField); } catch { return []; }
      };
      let purchaseRemarks = purchase ? parseRemarks(purchase.remarks) : [];
      let returnRemarks = purchaseReturn ? parseRemarks(purchaseReturn.remarks) : [];
      let offsetAmount = 0;
      if (purchase && purchaseReturn) {
        if (currentPurchaseDue > 0 && currentReturnDue < 0) {
          offsetAmount = Math.min(currentPurchaseDue, Math.abs(currentReturnDue));
          currentPurchaseDue -= offsetAmount;
          currentReturnDue += offsetAmount;
          purchaseRemarks.push({ action: `${offsetAmount} cleared via return credit by sync`, created_at: timestamp });
          returnRemarks.push({ action: `${offsetAmount} applied to clear open purchase by sync`, created_at: timestamp });
        }
        else if (currentPurchaseDue < 0 && currentReturnDue > 0) {
          offsetAmount = Math.min(Math.abs(currentPurchaseDue), currentReturnDue);
          currentPurchaseDue += offsetAmount;
          currentReturnDue -= offsetAmount;
          purchaseRemarks.push({ action: `${offsetAmount} overpayment absorbed by return over-refund by sync`, created_at: timestamp });
          returnRemarks.push({ action: `${offsetAmount} over-refund cleared via purchase overpayment by sync`, created_at: timestamp });
        }
      }
      // 4. Phase 2: Directional Cash Distribution Engine

      const netSystemDue = currentPurchaseDue + currentReturnDue;  const isIncomeFlow = netSystemDue < 0;
      let remainingCash = totalExternalPayment;
      if (remainingCash > 0) {
        if (isIncomeFlow) {
          // Cash Influx (Income): Vendor paying back refunds or overpayments
          if (purchaseReturn && currentReturnDue < 0 && remainingCash > 0) {
            const absoluteNeed = Math.abs(currentReturnDue);
            const allocated = Math.min(absoluteNeed, remainingCash);
            currentReturnDue += allocated;
            remainingCash -= allocated;

          }

          if (purchase && currentPurchaseDue < 0 && remainingCash > 0) {
            const absoluteNeed = Math.abs(currentPurchaseDue);
            const allocated = Math.min(absoluteNeed, remainingCash);
            currentPurchaseDue += allocated;
            remainingCash -= allocated;
          }
          // Spillover Safeguard
          if (remainingCash > 0) {
            if (purchaseReturn) currentReturnDue += remainingCash;
            else if (purchase) currentPurchaseDue += remainingCash;
            remainingCash = 0;
          }
        } else {
          // Cash Outflux (Expense): We are paying money to vendor
          if (purchase && currentPurchaseDue > 0 && remainingCash > 0) {
            const allocated = Math.min(currentPurchaseDue, remainingCash);
            currentPurchaseDue -= allocated;
            remainingCash -= allocated;
          }
          if (purchaseReturn && currentReturnDue > 0 && remainingCash > 0) {
            const allocated = Math.min(currentReturnDue, remainingCash);
            currentReturnDue -= allocated;
            remainingCash -= allocated;
          }
          // Spillover Safeguard
          if (remainingCash > 0) {
            if (purchase) currentPurchaseDue -= remainingCash;
            else if (purchaseReturn) currentReturnDue -= remainingCash;
            remainingCash = 0;
          }
        }
      }
      // 5. Phase 3: Calculate Final DB Target
      let finalPaidAmount = purchase ? Number(purchase.paid_amount) : 0;
      let finalRefundAmount = purchaseReturn ? Number(purchaseReturn.refund_amount) : 0;
      if (purchase) {
        finalPaidAmount = Number(purchase.final_amount) - currentPurchaseDue;
      }
      if (purchaseReturn) {
        finalRefundAmount = Number(purchaseReturn.final_amount) - (-currentReturnDue);
      }
      // 6. Safe Dominant Entity Selection
      let dominantEntity: "purchase" | "purchase_return" = "purchase";
      if (purchase && purchaseReturn) {
        dominantEntity = isIncomeFlow ? "purchase_return" : "purchase";
      } else {
        dominantEntity = purchase ? "purchase" : "purchase_return";
      }
      const dominantRefId = dominantEntity === "purchase" ? purchase_id : purchase_return_id;
      // 7. Execute Database Updates
      if (purchase) {
        const status = billStatus(purchase.final_amount, finalPaidAmount);
        await client.query(
          `UPDATE purchases SET paid_amount = $1, remarks = $2, status = $4 WHERE id = $3`,
          [finalPaidAmount, JSON.stringify(purchaseRemarks), purchase_id, status]
        );
      }
      if (purchaseReturn) {
        const status = billStatus(purchaseReturn.final_amount, finalRefundAmount);
        await client.query(
          `UPDATE purchase_return SET refund_amount = $1, remarks = $2, status = $4 WHERE id = $3`,
          [finalRefundAmount, JSON.stringify(returnRemarks), purchase_return_id, status]
        );
      }
      // 8. Record Ledger Entries with Dynamic Flow ("I" vs "E")
      if (totalExternalPayment > 0 && dominantRefId) {
        const paymentFlow = isIncomeFlow ? "I" : "E";
        for (const payment of payments) {
          if (Number(payment.payment_amount) <= 0) continue;
          await ptService.insertPaymentTransaction({
            ref_id: dominantRefId,
            amount: Number(payment.payment_amount),
            ref_type: PaymentTransactionTypeCodeMap["purchase_settlement"],
            status: getStatusCode("Paid"),
            payment_method_id: payment.payment_method_id,
            transaction_reference: payment.transaction_reference || `SETTLE-${timestamp}`,
            business_id: firm_id,
            business_ref: convertEntityType("Firm" as EntityKey),
            company_id,
            payment_flow: paymentFlow,
          }, client);
        }
      }
      return {
        success: true,
        message: "Settlement executed successfully.",
        offset_applied: offsetAmount,
        total_external_payment_applied: totalExternalPayment,
        payment_flow_recorded: isIncomeFlow ? "INCOME (I)" : "EXPENSE (E)",
        routed_to: totalExternalPayment > 0 ? dominantEntity : "none (Pure Balance Sync)"
      };
    });

  }

  async syncSaleAndReturn(data: SaleSettlementSyncBody) {
    const {
      firm_id,
      company_id,
      sale_id,
      sale_return_id,
      payments,
      updated_by
    } = data;

    if (!sale_id && !sale_return_id) {
      throw new AppError("You must provide either a sale_id or a sale_return_id to process a settlement.", 400);
    }

    return transaction(async (client: PoolClient) => {
      const ptService = new PaymentTransactionService();
      const timestamp = Date.now();

      const totalExternalPayment = payments.reduce((sum, p) => sum + Number(p.payment_amount), 0);

      let sale: any = null;
      let saleReturn: any = null;

      // 1. Fetch & Lock Records
      if (sale_id) {
        const sRes = await client.query(
          `SELECT id, final_amount, paid, remarks FROM sales WHERE id = $1 AND firm_id = $2 AND status != $3 FOR UPDATE`,
          [sale_id, firm_id, getStatusCode("Deleted")]
        );
        if (sRes.rows.length > 0) sale = sRes.rows[0];
      }

      if (sale_return_id) {
        const srRes = await client.query(
          `SELECT id, final_amount, paid_amount, remarks FROM sale_return WHERE id = $1 AND firm_id = $2 AND status != $3 FOR UPDATE`,
          [sale_return_id, firm_id, getStatusCode("Deleted")]
        );
        if (srRes.rows.length > 0) saleReturn = srRes.rows[0];
      }

      const parseRemarks = (remarkField: any) => {
        if (!remarkField) return [];
        if (Array.isArray(remarkField)) return remarkField;
        try { return JSON.parse(remarkField); } catch { return []; }
      };

      let saleRemarks = sale ? parseRemarks(sale.remarks) : [];
      let returnRemarks = saleReturn ? parseRemarks(saleReturn.remarks) : [];

      const saleFinal = sale ? Number(sale.final_amount) : 0;
      const returnFinal = saleReturn ? Number(saleReturn.final_amount) : 0;

      // Sanitize and cap initial DB inputs so bad DB state doesn't crash calculations
      let salePaid = sale ? Math.min(saleFinal, Math.max(0, Number(sale.paid))) : 0;
      let returnRefund = saleReturn ? Math.min(returnFinal, Math.max(0, Number(sale.paid_amount))) : 0;

      let saleDue = Math.max(0, saleFinal - salePaid);
      let returnDue = Math.max(0, returnFinal - returnRefund);

      // 2. Phase 1: Virtual Zero-Cash Cross-Offsetting
      let offsetAmount = 0;
      if (sale && saleReturn && saleDue > 0 && returnDue > 0) {
        offsetAmount = Math.min(saleDue, returnDue);

        salePaid += offsetAmount;
        returnRefund += offsetAmount;

        saleDue -= offsetAmount;
        returnDue -= offsetAmount;

        saleRemarks.push({ action: `${offsetAmount} cleared via return credit balance`, created_at: timestamp });
        returnRemarks.push({ action: `${offsetAmount} applied to clear open sale balance`, created_at: timestamp });
      }

      // 3. Phase 2: Direct Cash Allocation Engine
      let remainingCash = totalExternalPayment;

      if (remainingCash > 0) {

        // Priority 1: Clear open sale due
        if (sale && saleDue > 0) {
          const allocated = Math.min(saleDue, remainingCash);
          salePaid += allocated;
          saleDue -= allocated;
          remainingCash -= allocated;
        }

        // Priority 2: Clear open return refund due
        if (saleReturn && returnDue > 0 && remainingCash > 0) {
          const allocated = Math.min(returnDue, remainingCash);
          returnRefund += allocated;
          returnDue -= allocated;
          remainingCash -= allocated;
        }
      }

      // Ensure final values never exceed final amounts
      salePaid = Math.min(saleFinal, salePaid);
      returnRefund = Math.min(returnFinal, returnRefund);

      // 4. Update Sales Table
      if (sale) {
        const status = billStatus(sale.final_amount, salePaid);
        await client.query(
          `UPDATE sales SET paid = $1, remarks = $2, status = $4 WHERE id = $3`,
          [salePaid, JSON.stringify(saleRemarks), sale_id, status]
        );
      }

      // 5. Update Sale Return Table
      if (saleReturn) {
        const status = billStatus(saleReturn.final_amount, returnRefund);
        await client.query(
          `UPDATE sale_return SET paid_amount = $1, remarks = $2, status = $4 WHERE id = $3`,
          [returnRefund, JSON.stringify(returnRemarks), sale_return_id, status]
        );
      }

      // 6. Record Payment Transaction Log
      const dominantRefId = sale_id || sale_return_id;
      if (totalExternalPayment > 0 && dominantRefId) {
        for (const payment of payments) {
          if (Number(payment.payment_amount) <= 0) continue;

          await ptService.insertPaymentTransaction({
            ref_id: dominantRefId,
            amount: Number(payment.payment_amount),
            ref_type: PaymentTransactionTypeCodeMap["sale_settlement"],
            status: getStatusCode("Paid"),
            payment_method_id: payment.payment_method_id,
            transaction_reference: payment.transaction_reference || `SETTLE-${timestamp}`,
            business_id: firm_id,
            business_ref: convertEntityType("Firm" as EntityKey),
            company_id,
            payment_flow: "I"
          }, client);
        }
      }

      // 7. Calculate Final Financial Summary
      const finalSaleDue = Math.max(0, saleFinal - salePaid);
      const finalReturnDue = Math.max(0, returnFinal - returnRefund);

      const netBalanceDueToMe = finalSaleDue - finalReturnDue;

      const balanceDueToMe = netBalanceDueToMe > 0 ? netBalanceDueToMe : 0;
      const changeDueToCustomer = netBalanceDueToMe <= 0 ? Math.abs(netBalanceDueToMe) + remainingCash : remainingCash;

      return {
        success: true,
        message: "Settlement executed successfully.",
        offset_applied: offsetAmount,
        total_external_payment_applied: totalExternalPayment,
        sales_paid: salePaid,
        sale_return_refunded: returnRefund,
        balance_due_to_me: balanceDueToMe,
        change_due_to_customer: changeDueToCustomer
      };
    });
  }
}