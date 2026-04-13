import { executeInTransaction, transaction } from "../../config/db";
import { SalesForecastInput } from "./report.types";



export class SalesForecastService {

  async getSalesForecast(data: SalesForecastInput) {
    const {
      level,
      company_id,
      branch_id,
      firm_id,
      forecast_months = 3
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

      /* ================= FETCH LAST 6 MONTHS ================= */

      const result = await executeInTransaction(client, `
        SELECT 
          TO_CHAR(DATE_TRUNC('month', invoice_date), 'YYYY-MM') AS month,
          COALESCE(SUM(final_amount), 0) AS revenue
        FROM sales
        WHERE status != 0
        AND firm_id = ANY($1)
        AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY DATE_TRUNC('month', invoice_date)
        ORDER BY month ASC
      `, [firmIds]);

      const rows = result.rows;
      if (rows.length < 3) {
        return this.emptyResponse();
      }

      const revenues = rows.map((r: any) => Number(r.revenue));

      const weights = [0.5, 0.3, 0.2];

      const getWMA = (data: number[]) => {
        const last3 = data.slice(-3);
        return (
          last3[2] * weights[0] +
          last3[1] * weights[1] +
          last3[0] * weights[2]
        );
      };

      let tempData = [...revenues];
      const projections: any[] = [];

      for (let i = 0; i < forecast_months; i++) {
        const predicted = getWMA(tempData);

        tempData.push(predicted);

        const lastMonthDate = new Date(
          rows[rows.length - 1].month + "-01"
        );

        const nextMonth = new Date(
          lastMonthDate.getFullYear(),
          lastMonthDate.getMonth() + i + 1,
          1
        );

        const monthStr = nextMonth.toISOString().slice(0, 7);

        projections.push({
          month: monthStr,
          predicted_revenue: Number(predicted.toFixed(2)),
          lower_bound: Number((predicted * 0.9).toFixed(2)),
          upper_bound: Number((predicted * 1.1).toFixed(2))
        });
      }

      /* ================= FORECAST SUMMARY ================= */

      const next_month_predicted = projections[0]?.predicted_revenue || 0;

      const next_quarter_predicted = projections
        .slice(0, 3)
        .reduce((a, b) => a + b.predicted_revenue, 0);

      const next_year_predicted = next_month_predicted * 12;

      /* ================= CONFIDENCE ================= */

      const mean =
        revenues.reduce((a: number, b: number) => a + b, 0) / revenues.length;

      const variance =
        revenues.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) /
        revenues.length;

      let confidence: "high" | "medium" | "low" = "medium";

      if (variance < 100000) confidence = "high";
      else if (variance > 1000000) confidence = "low";

     
      return {
        forecast: {
          next_month_predicted,
          next_quarter_predicted: Number(next_quarter_predicted.toFixed(2)),
          next_year_predicted: Number(next_year_predicted.toFixed(2)),
          confidence,
          methodology: "weighted_moving_average",
          based_on_months: revenues.length
        },
        projections
      };

    });
  }

  /* ================= EMPTY ================= */

  private emptyResponse() {
    return {
      forecast: {
        next_month_predicted: 0,
        next_quarter_predicted: 0,
        next_year_predicted: 0,
        confidence: "low",
        methodology: "weighted_moving_average",
        based_on_months: 0
      },
      projections: []
    };
  }
}