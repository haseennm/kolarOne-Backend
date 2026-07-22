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


  // 3. CLOSE Function: Sync balances between a purchase and a retu



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