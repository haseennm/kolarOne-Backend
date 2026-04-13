import { executeInTransaction, transaction } from "../../config/db";
import { SalesTrendInput } from "./report.types";

export class SalesTrendService {

    async getSalesTrend(data: SalesTrendInput) {
        const {
            level,
            company_id,
            branch_id,
            firm_id,
            months = 6
        } = data;

        return transaction(async (client) => {

            /* ================= GET FIRM IDS ================= */

            let firmIds: number[] = [];

            if (level === "firm" && firm_id) {
                firmIds = [firm_id];
            }

            if (level === "branch" && branch_id) {
                const res = await executeInTransaction(
                    client,
                    `SELECT id FROM firm WHERE branch_id = $1`,
                    [branch_id]
                );
                firmIds = res.rows.map((r: any) => r.id);
            }

            if (level === "company" && company_id) {
                const res = await executeInTransaction(
                    client,
                    `
          SELECT f.id
          FROM firm f
          JOIN branches b ON b.id = f.branch_id
          WHERE b.company_id = $1
          `,
                    [company_id]
                );
                firmIds = res.rows.map((r: any) => r.id);
            }

            if (!firmIds.length) {
                return this.emptyResponse();
            }

            /* ================= FETCH MONTHLY DATA ================= */

            const result = await executeInTransaction(client, `
        SELECT 
          TO_CHAR(DATE_TRUNC('month', s.invoice_date), 'YYYY-MM') AS month,
          COALESCE(SUM(s.final_amount), 0) AS revenue,
          COALESCE(SUM(si.saled_qty), 0) AS units_sold,
          COUNT(DISTINCT s.id) AS transaction_count
        FROM sales s
        LEFT JOIN sales_items si ON si.sale_id = s.id
        WHERE s.status != 0
        AND s.firm_id = ANY($1)
        AND s.invoice_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${months - 1} months'
        GROUP BY DATE_TRUNC('month', s.invoice_date)
        ORDER BY month ASC
      `, [firmIds]);

            const rows = result.rows;

            if (!rows.length) {
                return this.emptyResponse();
            }

            /* ================= CALCULATIONS ================= */

            let prevRevenue = 0;
            let totalRevenue = 0;

            const monthly = rows.map((r: any, index: number) => {

                const revenue = Number(r.revenue);
                const units_sold = Number(r.units_sold);
                const transaction_count = Number(r.transaction_count);

                let growth_pct = 0;

                if (index > 0 && prevRevenue !== 0) {
                    growth_pct = ((revenue - prevRevenue) / prevRevenue) * 100;
                }

                prevRevenue = revenue;
                totalRevenue += revenue;

                return {
                    month: r.month,
                    revenue,
                    growth_pct: Number(growth_pct.toFixed(2)),
                    units_sold,
                    transaction_count
                };
            });

            /* ================= SUMMARY ================= */

            const revenues = monthly.map(m => m.revenue);

            const peakRevenue = Math.max(...revenues);
            const lowRevenue = Math.min(...revenues);

            const peakMonth = monthly.find(m => m.revenue === peakRevenue)?.month || "";
            const lowMonth = monthly.find(m => m.revenue === lowRevenue)?.month || "";

            const avgMonthlyRevenue = totalRevenue / monthly.length;

            const first = monthly[0]?.revenue || 0;
            const last = monthly[monthly.length - 1]?.revenue || 0;

            let overallGrowth = 0;
            if (first !== 0) {
                overallGrowth = ((last - first) / first) * 100;
            }

            return {
                monthly,
                summary: {
                    total_revenue: Number(totalRevenue.toFixed(2)),
                    avg_monthly_revenue: Number(avgMonthlyRevenue.toFixed(2)),
                    peak_revenue: peakRevenue,
                    peak_month: peakMonth,
                    low_revenue: lowRevenue,
                    low_month: lowMonth,
                    overall_growth_pct: Number(overallGrowth.toFixed(2))
                }
            };

        });
    }

    /* ================= EMPTY RESPONSE ================= */

    private emptyResponse() {
        return {
            monthly: [],
            summary: {
                total_revenue: 0,
                avg_monthly_revenue: 0,
                peak_revenue: 0,
                peak_month: "",
                low_revenue: 0,
                low_month: "",
                overall_growth_pct: 0
            }
        };
    }
}
