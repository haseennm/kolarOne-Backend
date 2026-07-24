// import { executeInTransaction, transaction } from "../../config/db";
// import { OpportunityForecastInput } from "./report.types";


// export class OpportunityForecastService {

//     async getOpportunityForecast(data: OpportunityForecastInput) {

//         const {
//             level,
//             company_id,
//             branch_id,
//             firm_id,
//             top_items_limit = 10
//         } = data;

//         return transaction(async (client) => {

//             /* ================= GET FIRM IDS ================= */

//             let firmIds: number[] = [];

//             if (level === "firm" && firm_id) {
//                 firmIds = [firm_id];
//             }

//             if (level === "branch" && branch_id) {
//                 const res = await executeInTransaction(
//                     client,
//                     `SELECT id FROM firm WHERE branch_id = $1`,
//                     [branch_id]
//                 );
//                 firmIds = res.rows.map((r: any) => r.id);
//             }

//             if (level === "company" && company_id) {
//                 const res = await executeInTransaction(
//                     client,
//                     `
//           SELECT f.id
//           FROM firm f
//           JOIN branches b ON b.id = f.branch_id
//           WHERE b.company_id = $1
//           `,
//                     [company_id]
//                 );
//                 firmIds = res.rows.map((r: any) => r.id);
//             }

//             if (!firmIds.length) {
//                 return this.emptyResponse();
//             }
//             /* ================= BASE QUERY ================= */

//             const baseQuery = `
//         FROM party_balance pb

//         JOIN sales s 
//           ON pb.ref_id = s.id AND pb.ref_type = 'S'

//         JOIN customers c 
//           ON c.id = s.customer_id

//         WHERE pb.ref_type = 'S'
//         AND pb.flow = 'I'
//         AND pb.status !=0
//         AND pb.balance > 0
//         AND pb.firm_id = ANY($1)
//       `;

//             /* ================= SUMMARY ================= */

//             const summaryRes = await executeInTransaction(client, `
//         SELECT
//           COALESCE(SUM(pb.balance), 0) AS total_open_amount,
//           COUNT(*) AS invoice_count,
//           COALESCE(AVG(CURRENT_DATE - s.invoice_date), 0) AS avg_days_pending,
//           COALESCE(SUM(CASE 
//             WHEN (CURRENT_DATE - s.invoice_date) > 60 THEN pb.balance 
//             ELSE 0 END), 0) AS critical_amount,
//           COUNT(CASE 
//             WHEN (CURRENT_DATE - s.invoice_date) > 60 THEN 1 
//           END) AS critical_count
//         ${baseQuery}
//       `, [firmIds]);

//             const summaryRow = summaryRes.rows[0];
//             /* ================= TOP ITEMS ================= */

//             const topItemsRes = await executeInTransaction(client, `
//         SELECT
//           c.customer_name AS party_name,
//           s.invoice_number,
//           pb.balance AS amount,
//           (CURRENT_DATE - s.invoice_date) AS days_pending,
//           s.invoice_date AS due_date
//         ${baseQuery}
//         ORDER BY days_pending DESC, amount DESC
//         LIMIT $2
//       `, [firmIds, top_items_limit]);

//             const top_items = topItemsRes.rows.map((r: any) => ({
//                 party_name: r.party_name,
//                 invoice_number: r.invoice_number,
//                 amount: Number(r.amount),
//                 days_pending: Number(r.days_pending),
//                 due_date: r.due_date
//             }));

//             /* ================= AGING ================= */

//             const agingRes = await executeInTransaction(client, `
//         SELECT
//           CASE
//             WHEN (CURRENT_DATE - s.invoice_date) BETWEEN 0 AND 30 THEN '0-30'
//             WHEN (CURRENT_DATE - s.invoice_date) BETWEEN 31 AND 60 THEN '31-60'
//             WHEN (CURRENT_DATE - s.invoice_date) BETWEEN 61 AND 90 THEN '61-90'
//             ELSE '90+'
//           END AS bucket,
//           COALESCE(SUM(pb.balance), 0) AS amount,
//           COUNT(*) AS count
//         ${baseQuery}
//         GROUP BY bucket
//       `, [firmIds]);

//             const agingMap: any = {
//                 "0-30": { label: "0–30 days", amount: 0, count: 0 },
//                 "31-60": { label: "31–60 days", amount: 0, count: 0 },
//                 "61-90": { label: "61–90 days", amount: 0, count: 0 },
//                 "90+": { label: "90+ days", amount: 0, count: 0 }
//             };

//             for (const row of agingRes.rows) {
//                 if (agingMap[row.bucket]) {
//                     agingMap[row.bucket] = {
//                         label: agingMap[row.bucket].label,
//                         amount: Number(row.amount),
//                         count: Number(row.count)
//                     };
//                 }
//             }

//             const aging = Object.values(agingMap);

//             /* ================= RESPONSE ================= */

//             return {
//                 summary: {
//                     total_open_amount: Number(summaryRow.total_open_amount),
//                     invoice_count: Number(summaryRow.invoice_count),
//                     avg_days_pending: Number(summaryRow.avg_days_pending),
//                     critical_amount: Number(summaryRow.critical_amount),
//                     critical_count: Number(summaryRow.critical_count)
//                 },
//                 top_items,
//                 aging
//             };

//         });
//     }

//     /* ================= EMPTY ================= */

//     private emptyResponse() {
//         return {
//             summary: {
//                 total_open_amount: 0,
//                 invoice_count: 0,
//                 avg_days_pending: 0,
//                 critical_amount: 0,
//                 critical_count: 0
//             },
//             top_items: [],
//             aging: [
//                 { label: "0–30 days", amount: 0, count: 0 },
//                 { label: "31–60 days", amount: 0, count: 0 },
//                 { label: "61–90 days", amount: 0, count: 0 },
//                 { label: "90+ days", amount: 0, count: 0 }
//             ]
//         };
//     }
// }

import { executeInTransaction, transaction } from "../../config/db";
import { OpportunityForecastInput } from "./report.types";

export class OpportunityForecastService {

    async getOpportunityForecast(data: OpportunityForecastInput) {

        const {
            level,
            company_id,
            branch_id,
            firm_id,
            top_items_limit = 10
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

            /* ================= BASE QUERY ================= */

            // Replaced party_balance with direct sales query where remaining due > 0
            const baseQuery = `
                FROM sales s
                JOIN customers c 
                  ON c.id = s.customer_id
                WHERE s.status != 0
                  AND (s.final_amount - COALESCE(s.paid, 0)) > 0
                  AND s.firm_id = ANY($1)
            `;

            /* ================= SUMMARY ================= */

            const summaryRes = await executeInTransaction(client, `
                SELECT
                  COALESCE(SUM(s.final_amount - COALESCE(s.paid, 0)), 0) AS total_open_amount,
                  COUNT(*) AS invoice_count,
                  COALESCE(AVG(CURRENT_DATE - s.invoice_date), 0) AS avg_days_pending,
                  COALESCE(SUM(CASE 
                    WHEN (CURRENT_DATE - s.invoice_date) > 60 
                    THEN (s.final_amount - COALESCE(s.paid, 0)) 
                    ELSE 0 
                  END), 0) AS critical_amount,
                  COUNT(CASE 
                    WHEN (CURRENT_DATE - s.invoice_date) > 60 THEN 1 
                  END) AS critical_count
                ${baseQuery}
            `, [firmIds]);

            const summaryRow = summaryRes.rows[0];

            /* ================= TOP ITEMS ================= */

            const topItemsRes = await executeInTransaction(client, `
                SELECT
                  c.customer_name AS party_name,
                  s.invoice_number,
                  (s.final_amount - COALESCE(s.paid, 0)) AS amount,
                  (CURRENT_DATE - s.invoice_date) AS days_pending,
                  s.invoice_date AS due_date
                ${baseQuery}
                ORDER BY days_pending DESC, amount DESC
                LIMIT $2
            `, [firmIds, top_items_limit]);

            const top_items = topItemsRes.rows.map((r: any) => ({
                party_name: r.party_name,
                invoice_number: r.invoice_number,
                amount: Number(r.amount),
                days_pending: Number(r.days_pending),
                due_date: r.due_date
            }));

            /* ================= AGING ================= */

            const agingRes = await executeInTransaction(client, `
                SELECT
                  CASE
                    WHEN (CURRENT_DATE - s.invoice_date) BETWEEN 0 AND 30 THEN '0-30'
                    WHEN (CURRENT_DATE - s.invoice_date) BETWEEN 31 AND 60 THEN '31-60'
                    WHEN (CURRENT_DATE - s.invoice_date) BETWEEN 61 AND 90 THEN '61-90'
                    ELSE '90+'
                  END AS bucket,
                  COALESCE(SUM(s.final_amount - COALESCE(s.paid, 0)), 0) AS amount,
                  COUNT(*) AS count
                ${baseQuery}
                GROUP BY bucket
            `, [firmIds]);

            const agingMap: any = {
                "0-30": { label: "0–30 days", amount: 0, count: 0 },
                "31-60": { label: "31–60 days", amount: 0, count: 0 },
                "61-90": { label: "61–90 days", amount: 0, count: 0 },
                "90+": { label: "90+ days", amount: 0, count: 0 }
            };

            for (const row of agingRes.rows) {
                if (agingMap[row.bucket]) {
                    agingMap[row.bucket] = {
                        label: agingMap[row.bucket].label,
                        amount: Number(row.amount),
                        count: Number(row.count)
                    };
                }
            }

            const aging = Object.values(agingMap);

            /* ================= RESPONSE ================= */

            return {
                summary: {
                    total_open_amount: Number(summaryRow.total_open_amount),
                    invoice_count: Number(summaryRow.invoice_count),
                    avg_days_pending: Number(summaryRow.avg_days_pending),
                    critical_amount: Number(summaryRow.critical_amount),
                    critical_count: Number(summaryRow.critical_count)
                },
                top_items,
                aging
            };

        });
    }

    /* ================= EMPTY ================= */

    private emptyResponse() {
        return {
            summary: {
                total_open_amount: 0,
                invoice_count: 0,
                avg_days_pending: 0,
                critical_amount: 0,
                critical_count: 0
            },
            top_items: [],
            aging: [
                { label: "0–30 days", amount: 0, count: 0 },
                { label: "31–60 days", amount: 0, count: 0 },
                { label: "61–90 days", amount: 0, count: 0 },
                { label: "90+ days", amount: 0, count: 0 }
            ]
        };
    }
}