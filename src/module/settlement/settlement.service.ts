import { query } from "../../config/db";

export default class SettlementService {

  // Fetches pending bills and calculates remaining amounts dynamically
 async getVendorBalances(firm_id: number) {

  // Modified query to pull fully paid purchases IF they have an outstanding return balance
  const purchasesQuery = `
    SELECT
      id AS purchase_id,
      bill_number,
      final_amount,
      paid_amount,
      (final_amount - paid_amount) AS purchase_remaining_amount
    FROM purchases
    WHERE firm_id = $1
      AND status != 0
      AND (
        final_amount != paid_amount
        OR id IN (
          SELECT purchase_id 
          FROM purchase_return 
          WHERE firm_id = $1 
            AND status != 0 
            AND final_amount != refund_amount
        )
      )
    ORDER BY bill_date ASC
  `;

  const purchases = await query(purchasesQuery, [firm_id]);

  const returnsQuery = `
    SELECT
      pr.id AS return_id,
      pr.purchase_id,
      pr.return_number,
      pr.final_amount,
      pr.refund_amount,
      (pr.final_amount - pr.refund_amount) AS return_remaining_amount
    FROM purchase_return pr
    WHERE pr.firm_id = $1
      AND pr.status != 0
      AND pr.final_amount != pr.refund_amount
    ORDER BY pr.return_date ASC
  `;

  const returns = await query(returnsQuery, [firm_id]);

  const returnsMap = returns.reduce((acc, ret) => {
    if (!acc[ret.purchase_id]) {
      acc[ret.purchase_id] = [];
    }
    acc[ret.purchase_id].push(ret);
    return acc;
  }, {} as Record<number, any[]>);

  const purchaseBalances = purchases.map((purchase) => {
    const purchaseReturns = returnsMap[purchase.purchase_id] || [];
    const purchaseRemaining = Number(purchase.purchase_remaining_amount);

    const totalReturnRemaining = purchaseReturns.reduce(
      (sum: number, r: any) => sum + Number(r.return_remaining_amount),
      0
    );

    const netRemaining = purchaseRemaining - totalReturnRemaining;

    return {
      ...purchase,
      returns: purchaseReturns,
      summary: {
        purchase_remaining_amount: purchaseRemaining,
        total_return_remaining: totalReturnRemaining,
        net_remaining: netRemaining,
        status:
          netRemaining > 0
            ? "pending"
            : netRemaining < 0
              ? "refund"
              : "settled",
      },
    };
  });

  const total_purchase_remaining = purchases.reduce(
    (sum, p) => sum + Number(p.purchase_remaining_amount),
    0
  );

  const total_return_remaining = returns.reduce(
    (sum, r) => sum + Number(r.return_remaining_amount),
    0
  );

  return {
    purchaseBalances,
    summary: {
      total_purchase_remaining,
      total_return_remaining,
      total_remaining_amount: total_purchase_remaining - total_return_remaining,
    },
  };
}

  async getCustomerBalances(firm_id: number) {
  // Modified query to pull fully paid sales IF they have an outstanding return balance
  const saleQuery = `
    SELECT
      id AS sale_id,
      invoice_number,
      final_amount,
      paid AS paid_amount,
      (final_amount - paid) AS sale_remaining_amount
    FROM sales
    WHERE firm_id = $1
      AND status != 0
      AND (
        final_amount != paid
        OR id IN (
          SELECT sale_id 
          FROM sale_return 
          WHERE firm_id = $1 
            AND status != 0 
            AND final_amount != paid_amount
        )
      )
    ORDER BY invoice_date ASC
  `;

  const sales = await query(saleQuery, [firm_id]);

  const returnsQuery = `
    SELECT
      sr.id AS return_id,
      sr.sale_id,
      sr.return_number,
      sr.final_amount,
      sr.paid_amount AS refund_amount,
      (sr.final_amount - sr.paid_amount) AS return_remaining_amount
    FROM sale_return sr
    WHERE sr.firm_id = $1
      AND sr.status != 0
      AND sr.final_amount != sr.paid_amount
    ORDER BY sr.return_date ASC
  `;

  const returns = await query(returnsQuery, [firm_id]);

  const returnsMap = returns.reduce((acc, ret) => {
    if (!acc[ret.sale_id]) {
      acc[ret.sale_id] = [];
    }
    acc[ret.sale_id].push(ret);
    return acc;
  }, {} as Record<number, any[]>);

  const saleBalances = sales.map((sale) => {
    const saleReturns = returnsMap[sale.sale_id] || [];
    const saleRemaining = Number(sale.sale_remaining_amount);

    const totalReturnRemaining = saleReturns.reduce(
      (sum: number, r: any) => sum + Number(r.return_remaining_amount),
      0
    );

    const netRemaining = saleRemaining - totalReturnRemaining;

    return {
      ...sale,
      returns: saleReturns,
      summary: {
        sale_remaining_amount: saleRemaining,
        total_return_remaining: totalReturnRemaining,
        net_remaining: netRemaining,
        status:
          netRemaining > 0
            ? "pending"
            : netRemaining < 0
              ? "refund"
              : "settled",
      },
    };
  });

  const total_sale_remaining = sales.reduce(
    (sum, p) => sum + Number(p.sale_remaining_amount),
    0
  );

  const total_return_remaining = returns.reduce(
    (sum, r) => sum + Number(r.return_remaining_amount),
    0
  );

  return {
    saleBalances,
    summary: {
      total_sale_remaining,
      total_return_remaining,
      total_remaining_amount: total_sale_remaining - total_return_remaining,
    },
  };
}
}