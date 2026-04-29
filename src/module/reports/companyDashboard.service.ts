import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";


export class CompanyDashboardService {

    async getCompanySummary({ company_id }: { company_id: number }) {
  return transaction(async (client) => {

    // 1. Sales aggregation (current + previous periods)
    const result = await client.query(`
      SELECT
        -- Today
        COALESCE(SUM(CASE 
          WHEN s.invoice_date = CURRENT_DATE 
          THEN s.final_amount END), 0) AS today_sales,

        -- Yesterday
        COALESCE(SUM(CASE 
          WHEN s.invoice_date = CURRENT_DATE - INTERVAL '1 day'
          THEN s.final_amount END), 0) AS yesterday_sales,

        -- MTD
        COALESCE(SUM(CASE 
          WHEN s.invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
          THEN s.final_amount END), 0) AS mtd_sales,

        -- Last Month MTD (for comparison)
        COALESCE(SUM(CASE 
          WHEN s.invoice_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND s.invoice_date < DATE_TRUNC('month', CURRENT_DATE)
          THEN s.final_amount END), 0) AS last_mtd_sales,

        -- YTD
        COALESCE(SUM(CASE 
          WHEN s.invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
          THEN s.final_amount END), 0) AS ytd_sales,

        -- Last Year YTD
        COALESCE(SUM(CASE 
          WHEN s.invoice_date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
          AND s.invoice_date < DATE_TRUNC('year', CURRENT_DATE)
          THEN s.final_amount END), 0) AS last_ytd_sales

      FROM sales s
      JOIN firm f ON f.id = s.firm_id
      JOIN branches b ON b.id = f.branch_id
      WHERE b.company_id = $1
      AND s.status = 4
    `, [company_id]);

    const d = result.rows[0];

    // % helper
    const calcPct = (current: number, prev: number) => {
      if (prev === 0) return 0;
      return ((current - prev) / prev) * 100;
    };

    // 2. Branch stats
    const branchStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 1) AS active_branches,
        COUNT(*) FILTER (WHERE status != 0) AS total_branches
      FROM branches
      WHERE company_id = $1
    `, [company_id]);

    return {
      today_sales: Number(d.today_sales),
      today_sales_change_pct: Number(
        calcPct(Number(d.today_sales), Number(d.yesterday_sales)).toFixed(2)
      ),

      mtd_sales: Number(d.mtd_sales),
      mtd_sales_change_pct: Number(
        calcPct(Number(d.mtd_sales), Number(d.last_mtd_sales)).toFixed(2)
      ),

      ytd_sales: Number(d.ytd_sales),
      ytd_sales_change_pct: Number(
        calcPct(Number(d.ytd_sales), Number(d.last_ytd_sales)).toFixed(2)
      ),

      active_branches: Number(branchStats.rows[0].active_branches),
      total_branches: Number(branchStats.rows[0].total_branches),
    };
  });
}

async getBranchPerformance({ company_id }: { company_id: number }) {
  return transaction(async (client) => {

    const result = await client.query(`
      SELECT
        b.id,
        b.branch_name,
        b.branch_code,
        b.city,
        b.status,

        -- Today Sales
        COALESCE(SUM(CASE 
          WHEN s.invoice_date = CURRENT_DATE 
          THEN s.final_amount END), 0) AS today_sales,

        -- Bills
        COUNT(CASE 
          WHEN s.invoice_date = CURRENT_DATE THEN 1 END) AS total_bills_today,

        -- Stock Value (current inventory)
        COALESCE(SUM(st.available_quantity * st.selling_price), 0) AS stock_value,

        -- LOW STOCK
     COALESCE((
  SELECT COUNT(*)
  FROM (
    SELECT 
      st.product_id
    FROM stock st
    WHERE st.branch_id = b.id
    AND st.status = 12
    GROUP BY st.product_id
    HAVING SUM(st.available_quantity) <= 10
  ) AS low_products
), 0) AS low_stock_count,

        -- ✅ REAL PROFIT
        COALESCE(SUM(
          CASE 
            WHEN s.invoice_date = CURRENT_DATE THEN
              (si.unit_price - pi.unit_price) * si.saled_qty
          END
        ), 0) AS today_profit

      FROM branches b

      LEFT JOIN firm f ON f.branch_id = b.id

      LEFT JOIN sales s 
        ON s.firm_id = f.id 
        AND s.status = 4

      LEFT JOIN sales_items si 
        ON si.sale_id = s.id

      LEFT JOIN stock st2 
        ON st2.id = si.stock_id

      LEFT JOIN purchase_items pi 
        ON pi.stock_id = st2.id

      -- stock table for inventory
      LEFT JOIN stock st 
        ON st.branch_id = b.id 
        AND st.status = 12

      WHERE b.company_id = $1
      AND b.status != 0

      GROUP BY b.id
      ORDER BY today_sales DESC
    `, [company_id]);
    return {
      branches: result.rows.map((row) => ({
        branch_id: row.id,
        branch_name: row.branch_name,
        branch_code: row.branch_code,
        location: row.city,
        status: row.status,
        today_sales: Number(row.today_sales),
        stock_value: Number(row.stock_value),
        today_profit: Number(row.today_profit),
        total_bills_today: Number(row.total_bills_today),
        low_stock_count: Number(row.low_stock_count),
        is_offline: row.status !== 1
      }))
    };
  });
}
}