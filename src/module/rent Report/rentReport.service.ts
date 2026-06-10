// report.service.ts
import { executeInTransaction, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord, getStatusCode } from "../../utils/extra";
import { RentReportInput, RentReportResponse, RentReportItem, RentBranchSummary, TimePeriodSummary, RentReportFilterInput, OverdayReportItem, DamageMissingReportItem, ReturnReportItem } from "./rentReport.types";

export class ReportService {

  async getRentReport(data: RentReportInput): Promise<RentReportResponse> {
    const { company_id, branch_id, level, cashflow } = data;

    return transaction(async (client) => {
      /* ================= 1. BUILD CONDITIONAL QUERIES ================= */
      let queryArgs: any[] = [];
      let conditions: string[] = [];

      let cashFlowFilter: string | null = null;
      if (cashflow === "income") cashFlowFilter = "in";
      if (cashflow === "expense") cashFlowFilter = "out";

      if (level === "branch" && branch_id) {
        const isExistBranch = await getRecord(
          branch_id,
          "branches",
          "company_id",
          company_id,
          client
        )
        if (!isExistBranch) {
          throw new AppError("Branch not found", 404)
        }
      }
      if (level === "branch") {
        queryArgs.push(branch_id);
        conditions.push(`rp.branch_id = $${queryArgs.length}`);
      } else {
        queryArgs.push(company_id);
        conditions.push(`b.company_id = $${queryArgs.length}`);
      }

      if (cashFlowFilter) {
        queryArgs.push(cashFlowFilter);
        conditions.push(`rp.cash_flow = $${queryArgs.length}`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      /* ================= 2. EXECUTE QUERY WITH JOINS ================= */
      const query = `
        SELECT 
          rp.id,
          rp.ref_no,
          rp.branch_id,
          b.branch_name,
          rp.amount,
          rp.payment_method_id,
          rp.row_type,
          rp.row_id,
          rp.cash_flow,
          rp.note,
          rp.remarks,
          rp.status,
          rp.created_at,
          
          -- Bill Related Details
          rb.bill_number AS bill_number,
          rb.customer_id AS bill_customer_id,
          c1.customer_name AS bill_customer_name,
          
          -- Advance Related Details
          rcl.customer_id AS advance_customer_id,
          c2.customer_name AS advance_customer_name,
          
          -- Loss Stock Related Details
          ls.product_id AS loss_product_id,
          ls.quantity AS loss_quantity,
          ls.responsible_type AS loss_responsible_type,
          ls.payment_status AS loss_payment_status,
          c3.customer_name AS loss_customer_name
          
        FROM rent_payments rp
        JOIN branches b ON b.id = rp.branch_id
        
        LEFT JOIN rent_bills rb ON rp.row_type = 'bill' AND rb.id = rp.row_id
        LEFT JOIN customers c1 ON c1.id = rb.customer_id
        
        LEFT JOIN rent_customer_ledger rcl ON rp.row_type = 'advance' AND rcl.id = rp.row_id
        LEFT JOIN customers c2 ON c2.id = rcl.customer_id
        
        LEFT JOIN loss_stocks ls ON rp.row_type = 'loss' AND ls.id = rp.row_id
        LEFT JOIN customers c3 ON c3.id = ls.customer_id
        
        ${whereClause}
        ORDER BY rp.created_at DESC, rp.id DESC
      `;

      const result = await executeInTransaction(client, query, queryArgs);
      const rows = result.rows;

      /* ================= 3. TIME-PERIOD AGGREGATION INITIALIZATION ================= */
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11
      const currentDate = now.getDate();

      // Factory helper to keep code clean
      const initPeriodSummary = (): TimePeriodSummary => ({ income: 0, expense: 0, net: 0 });

      // Global metric buckets
      let totalIncome = 0;
      let totalExpense = 0;
      let globalToday = initPeriodSummary();
      let globalMonth = initPeriodSummary();
      let globalYear = initPeriodSummary();

      const branchSummaryMap: Record<string, RentBranchSummary> = {};

      /* ================= 4. MAP DATA & CALCULATE SUMMARIES ================= */
      const reportData: RentReportItem[] = rows.map((row: any) => {
        const amount = Number(row.amount || 0);
        const txDate = new Date(row.created_at);
        const isIncome = row.cash_flow === "in";

        // Verify time thresholds
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth();
        const txDay = txDate.getDate();

        const isToday = txYear === currentYear && txMonth === currentMonth && txDay === currentDate;
        const isThisMonth = txYear === currentYear && txMonth === currentMonth;
        const isThisYear = txYear === currentYear;

        // Populate Global Core metrics
        if (isIncome) totalIncome += amount;
        else totalExpense += amount;

        // Accumulate Global Time-period metrics
        if (isToday) {
          if (isIncome) globalToday.income += amount;
          else globalToday.expense += amount;
        }
        if (isThisMonth) {
          if (isIncome) globalMonth.income += amount;
          else globalMonth.expense += amount;
        }
        if (isThisYear) {
          if (isIncome) globalYear.income += amount;
          else globalYear.expense += amount;
        }

        // Handle Branch-wise structural aggregation blocks
        if (level === "company") {
          if (!branchSummaryMap[row.branch_id]) {
            branchSummaryMap[row.branch_id] = {
              branch_id: row.branch_id,
              branch_name: row.branch_name || row.branch_code || `Branch ${row.branch_id}`,
              total_income: 0,
              total_expense: 0,
              net_amount: 0,
              transaction_count: 0,
              today_summary: initPeriodSummary(),
              month_summary: initPeriodSummary(),
              year_summary: initPeriodSummary()
            };
          }

          const bRef = branchSummaryMap[row.branch_id];
          bRef.transaction_count++;

          if (isIncome) bRef.total_income += amount;
          else bRef.total_expense += amount;

          // Branch Specific Time Summaries
          if (isToday) {
            if (isIncome) bRef.today_summary.income += amount;
            else bRef.today_summary.expense += amount;
          }
          if (isThisMonth) {
            if (isIncome) bRef.month_summary.income += amount;
            else bRef.month_summary.expense += amount;
          }
          if (isThisYear) {
            if (isIncome) bRef.year_summary.income += amount;
            else bRef.year_summary.expense += amount;
          }
        }

        // Polymorphic relation remapping logic
        let details: any = null;
        if (row.row_type === "bill") {
          details = {
            bill_number: row.bill_number,
            customer_id: row.bill_customer_id,
            customer_name: row.bill_customer_name
          };
        } else if (row.row_type === "advance") {
          details = {
            customer_id: row.advance_customer_id,
            customer_name: row.advance_customer_name
          };
        } else if (row.row_type === "loss") {
          details = {
            product_id: row.loss_product_id,
            quantity: Number(row.loss_quantity || 0),
            responsible_type: row.loss_responsible_type,
            payment_status: row.loss_payment_status,
            customer_name: row.loss_customer_name || "Branch Responsibility"
          };
        }

        return {
          id: row.id,
          ref_no: row.ref_no,
          branch_id: row.branch_id,
          branch_name: row.branch_name,
          amount,
          payment_method_id: row.payment_method_id,
          row_type: row.row_type,
          row_id: row.row_id,
          cash_flow: row.cash_flow,
          note: row.note,
          remarks: row.remarks,
          status: row.status,
          created_at: txDate,
          details
        };
      });

      // Calculate Nets for global calculations
      globalToday.net = globalToday.income - globalToday.expense;
      globalMonth.net = globalMonth.income - globalMonth.expense;
      globalYear.net = globalYear.income - globalYear.expense;

      /* ================= 5. OUTPUT FINAL PAYLOAD ================= */
      const finalResponse: RentReportResponse = {
        summary: {
          total_income: totalIncome,
          total_expense: totalExpense,
          net_amount: totalIncome - totalExpense,
          today_summary: globalToday,
          month_summary: globalMonth,
          year_summary: globalYear
        },
        data: reportData
      };

      if (level === "company") {
        finalResponse.branch_wise = Object.values(branchSummaryMap).map((b) => {
          b.net_amount = b.total_income - b.total_expense;
          b.today_summary.net = b.today_summary.income - b.today_summary.expense;
          b.month_summary.net = b.month_summary.income - b.month_summary.expense;
          b.year_summary.net = b.year_summary.income - b.year_summary.expense;
          return b;
        });
      }

      return finalResponse;
    });
  }
  async getProductWiseRentReport(data: { company_id: number; branch_id?: number; level: "company" | "branch" }) {
    const { company_id, branch_id, level } = data;

    return transaction(async (client) => {
      const statusDamaged = getStatusCode("Damaged");
      const statusMissing = getStatusCode("Miss");

      let queryArgs: any[] = [];
      let branchCondition = "";

      if (level === "branch") {
        queryArgs.push(branch_id);
        branchCondition = `AND rb.branch_id = $${queryArgs.length}`;
      } else {
        queryArgs.push(company_id);
        branchCondition = `AND b.company_id = $${queryArgs.length}`;
      }

      const query = `
        SELECT 
          p.id as product_id,
          p.name AS product_name,
          rs.stock_type,
          rs.hourly_rate,
          rs.daily_rate,
          b.id as branch_id,
          b.branch_name,
          rbi.quantity_taken,
          rbi.returned_qty,
          rbi.amount as item_revenue, -- Updated here to target your newly added amount column
          rb.start_date as created_at,
          
          COALESCE((
            SELECT SUM(ls.quantity) 
            FROM loss_stocks ls 
            WHERE ls.rent_stock_id = rbi.rent_stock_id 
            AND ls.status IN (${statusDamaged}, ${statusMissing})
          ), 0) as units_lost,
          
          COALESCE((
            SELECT SUM(ls.amount) 
            FROM loss_stocks ls 
            WHERE ls.rent_stock_id = rbi.rent_stock_id 
            AND ls.status IN (${statusDamaged}, ${statusMissing})
          ), 0) as penalty_charged,
          
          COALESCE((
            SELECT SUM(ls.paid) 
            FROM loss_stocks ls 
            WHERE ls.rent_stock_id = rbi.rent_stock_id 
            AND ls.status IN (${statusDamaged}, ${statusMissing})
          ), 0) as penalty_collected

        FROM rent_bill_items rbi
        JOIN rent_bills rb ON rbi.bill_id = rb.id
        JOIN products p ON rbi.product_id = p.id
        JOIN rental_stocks rs ON rbi.rent_stock_id = rs.id
        JOIN branches b ON rb.branch_id = b.id
        WHERE 1=1 ${branchCondition}
      `;

      const result = await executeInTransaction(client, query, queryArgs);
      const rows = result.rows;

      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      const curDay = now.getDate();

      const productMap: Record<string, any> = {};
      const branchMap: Record<string, any> = {};

      let gRented = 0, gRevenue = 0, gLost = 0;
      let gToday = { units_rented: 0, revenue: 0 };
      let gMonth = { units_rented: 0, revenue: 0 };
      let gYear = { units_rented: 0, revenue: 0 };

      rows.forEach(row => {
        const qty = Number(row.quantity_taken || 0);
        const rev = Number(row.item_revenue || 0);
        const lost = Number(row.units_lost || 0);
        const txDate = new Date(row.created_at);

        const isToday = txDate.getFullYear() === curYear && txDate.getMonth() === curMonth && txDate.getDate() === curDay;
        const isMonth = txDate.getFullYear() === curYear && txDate.getMonth() === curMonth;
        const isYear = txDate.getFullYear() === curYear;

        // 1. Core Product Aggregation
        if (!productMap[row.product_id]) {
          productMap[row.product_id] = {
            product_id: row.product_id,
            product_name: row.product_name,
            stock_type: row.stock_type,
            hourly_rate: Number(row.hourly_rate || 0),
            daily_rate: Number(row.daily_rate || 0),
            total_units_rented: 0, total_units_returned: 0, total_units_lost: 0,
            total_revenue: 0, total_loss_penalty_charged: 0, total_loss_collected: 0,
            today: { units_rented: 0, revenue: 0 },
            this_month: { units_rented: 0, revenue: 0 },
            this_year: { units_rented: 0, revenue: 0 }
          };
        }

        const p = productMap[row.product_id];
        p.total_units_rented += qty;
        p.total_units_returned += Number(row.returned_qty || 0);
        p.total_units_lost += lost;
        p.total_revenue += rev;
        p.total_loss_penalty_charged += Number(row.penalty_charged || 0);
        p.total_loss_collected += Number(row.penalty_collected || 0);

        if (isToday) { p.today.units_rented += qty; p.today.revenue += rev; }
        if (isMonth) { p.this_month.units_rented += qty; p.this_month.revenue += rev; }
        if (isYear) { p.this_year.units_rented += qty; p.this_year.revenue += rev; }

        // 2. Master Global Aggregations
        gRented += qty;
        gRevenue += rev;
        gLost += lost;
        if (isToday) { gToday.units_rented += qty; gToday.revenue += rev; }
        if (isMonth) { gMonth.units_rented += qty; gMonth.revenue += rev; }
        if (isYear) { gYear.units_rented += qty; gYear.revenue += rev; }

        // 3. Branch Specific Hierarchies (Company Level View)
        if (level === "company") {
          if (!branchMap[row.branch_id]) {
            branchMap[row.branch_id] = {
              branch_id: row.branch_id,
              branch_name: row.branch_name,
              total_units_rented: 0,
              total_revenue: 0,
              today_summary: { units_rented: 0, revenue: 0 },
              month_summary: { units_rented: 0, revenue: 0 },
              year_summary: { units_rented: 0, revenue: 0 },
              products: {}
            };
          }

          const b = branchMap[row.branch_id];
          b.total_units_rented += qty;
          b.total_revenue += rev;

          if (isToday) { b.today_summary.units_rented += qty; b.today_summary.revenue += rev; }
          if (isMonth) { b.month_summary.units_rented += qty; b.month_summary.revenue += rev; }
          if (isYear) { b.year_summary.units_rented += qty; b.year_summary.revenue += rev; }

          if (!b.products[row.product_id]) {
            b.products[row.product_id] = {
              product_id: row.product_id,
              product_name: row.product_name,
              units_rented: 0,
              revenue: 0
            };
          }
          b.products[row.product_id].units_rented += qty;
          b.products[row.product_id].revenue += rev;
        }
      });

      return {
        summary: {
          total_units_rented: gRented,
          total_revenue: gRevenue,
          total_units_lost: gLost,
          today_summary: gToday,
          month_summary: gMonth,
          year_summary: gYear
        },
        products_data: Object.values(productMap),
        branch_wise: level === "company" ? Object.values(branchMap).map((b: any) => ({
          ...b,
          products: Object.values(b.products)
        })) : undefined
      };
    });
  }
  private buildBranchCondition(level: string, company_id: number, branch_id?: number, queryArgs: any[] = []): { condition: string, args: any[] } {
    let condition = "";
    if (level === "branch") {
      queryArgs.push(branch_id);
      condition = `AND b.id = $${queryArgs.length}`;
    } else {
      queryArgs.push(company_id);
      condition = `AND b.company_id = $${queryArgs.length}`;
    }
    return { condition, args: queryArgs };
  }

  async fetchReturnItemsReport(data: RentReportFilterInput): Promise<ReturnReportItem[]> {
    return transaction(async (client) => {
      const { condition, args } = this.buildBranchCondition(data.level, data.company_id, data.branch_id);

      // Filters only records that have a return quantity greater than zero
      const query = `
        SELECT 
          rb.id as bill_id,
          rb.bill_number,
          c.customer_name,
          b.branch_name,
          p.name AS product_name,
          rbi.quantity_taken,
          rbi.returned_qty,
          rbi.rate_per_item,
          rb.actual_close_date
        FROM rent_bill_items rbi
        JOIN rent_bills rb ON rbi.bill_id = rb.id
        JOIN customers c ON rb.customer_id = c.id
        JOIN branches b ON rb.branch_id = b.id
        JOIN products p ON rbi.product_id = p.id
        WHERE rbi.returned_qty < rbi.quantity_taken  ${condition}
        ORDER BY rb.actual_close_date DESC, rb.id DESC
      `;

      const result = await executeInTransaction(client, query, args);
      return result.rows.map((row: any) => ({
        bill_id: row.bill_id,
        bill_number: row.bill_number,
        customer_name: row.customer_name,
        branch_name: row.branch_name,
        product_name: row.product_name,
        quantity_taken: Number(row.quantity_taken),
        returned_qty: Number(row.returned_qty),
        rate_per_item: Number(row.rate_per_item),
        actual_close_date: row.actual_close_date ? new Date(row.actual_close_date) : null
      }));
    });
  }

  async fetchDamageMissingReport(data: RentReportFilterInput): Promise<DamageMissingReportItem[]> {
    return transaction(async (client) => {
      const { condition, args } = this.buildBranchCondition(data.level, data.company_id, data.branch_id);

      // Dynamically resolve internal configuration status keys
      const codeDamaged = getStatusCode("Damaged"); // resolves to 13
      const codeMissing = getStatusCode("Miss"); // resolves to 15

      const codePaid = getStatusCode("Paid");       // resolves to 5
      const codeUnpaid = getStatusCode("Unpaid");   // resolves to 10
      const codePartial = getStatusCode("Partial"); // resolves to 11

      const query = `
        SELECT 
          ls.id as loss_id,
          p.name AS product_name,
          b.branch_name,
          ls.responsible_type,
          c.customer_name,
          ls.quantity as quantity_lost,
          ls.status as loss_status_code,
          ls.amount as penalty_amount,
          ls.paid as paid_amount,
          ls.payment_status as payment_status_code
        FROM loss_stocks ls
        JOIN products p ON ls.product_id = p.id
        JOIN branches b ON ls.branch_id = b.id
        LEFT JOIN customers c ON ls.customer_id = c.id
        WHERE ls.status IN (${codeDamaged}, ${codeMissing}) ${condition}
        ORDER BY ls.id DESC, ls.id DESC
      `;

      const result = await executeInTransaction(client, query, args);
      return result.rows.map((row: any) => {
        // Map back status labels based on codes safely
        let loss_type: "Damaged" | "Missing" = "Damaged";
        if (Number(row.loss_status_code) === codeMissing) loss_type = "Missing";

        let payment_status_text: "Paid" | "Unpaid" | "Partial" = "Unpaid";
        if (Number(row.payment_status_code) === codePaid) payment_status_text = "Paid";
        else if (Number(row.payment_status_code) === codePartial) payment_status_text = "Partial";

        return {
          loss_id: row.loss_id,
          product_name: row.product_name,
          branch_name: row.branch_name,
          responsible_type: row.responsible_type,
          customer_name: row.customer_name || null,
          quantity_lost: Number(row.quantity_lost),
          loss_type,
          penalty_amount: Number(row.penalty_amount),
          paid_amount: Number(row.paid_amount),
          payment_status_text,
          created_at: new Date(row.created_at)
        };
      });
    });
  }

  async fetchOverdayReport(data: RentReportFilterInput): Promise<OverdayReportItem[]> {
    return transaction(async (client) => {
      const { condition, args } = this.buildBranchCondition(data.level, data.company_id, data.branch_id);

      // Filters parameters: 
      // - Not fully returned (quantity_taken > returned_qty)
      // - expected_return_date has passed compared to the current timestamp clock
      // - actual_close_date is null (bill is still active)
      const query = `
        SELECT 
          rb.id as bill_id,
          rb.bill_number,
          c.customer_name,
          c.phone_number as customer_phone,
          b.branch_name,
          p.name AS product_name,
          (rbi.quantity_taken - rbi.returned_qty) as remaining_qty,
          rb.expected_return_date,
          EXTRACT(DAY FROM (NOW() - rb.expected_return_date)) as days_overdue
        FROM rent_bill_items rbi
        JOIN rent_bills rb ON rbi.bill_id = rb.id
        JOIN customers c ON rb.customer_id = c.id
        JOIN branches b ON rb.branch_id = b.id
        JOIN products p ON rbi.product_id = p.id
        WHERE rb.actual_close_date IS NULL
          AND rbi.quantity_taken > rbi.returned_qty
          AND rb.expected_return_date < NOW()
          ${condition}
        ORDER BY days_overdue DESC, rb.id DESC
      `;

      const result = await executeInTransaction(client, query, args);
      return result.rows.map((row: any) => ({
        bill_id: row.bill_id,
        bill_number: row.bill_number,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone || null,
        branch_name: row.branch_name,
        product_name: row.product_name,
        quantity_taken: Number(row.remaining_qty),
        expected_return_date: new Date(row.expected_return_date),
        days_overdue: Math.floor(Number(row.days_overdue || 0))
      }));
    });
  }
  async getRentDashboard(data: {
    company_id: number;
    branch_id: number;
  }) {
    const { company_id, branch_id } = data;

    return transaction(async (client) => {

      let queryArgs: any[] = [];
      let billCondition = "";
      let customerCondition = "";
      let stockCondition = "";

      queryArgs.push(branch_id);

      billCondition = `rb.branch_id = $${queryArgs.length}`;
      stockCondition = `rs.branch_id = $${queryArgs.length}`;
      queryArgs.push(company_id);

      const companyParam = queryArgs.length;

      customerCondition = `c.company_id = $${companyParam}`;

      const activeStatus = getStatusCode("Active");       // 1
      const blacklistStatus = getStatusCode("blacklist"); // 17

      const query = `
      SELECT
        (
          SELECT COUNT(*)
          FROM rent_bills rb
          WHERE ${billCondition}
          AND rb.status = ${activeStatus} AND DATE(rb.start_date) = CURRENT_DATE
        ) AS today_active_rent_bills,

        (
          SELECT COUNT(*)
          FROM rent_bills rb
          WHERE ${billCondition}
          AND DATE(rb.actual_close_date) = CURRENT_DATE
        ) AS today_closed_rent_bills,

        (
          SELECT COUNT(*)
          FROM rent_bills rb
          WHERE ${billCondition}
          AND rb.actual_close_date IS NULL
          AND rb.expected_return_date < CURRENT_DATE
        ) AS overdue_rent_bills,

        (
          SELECT COALESCE(SUM(rbi.quantity_taken),0)
          FROM rent_bill_items rbi
          JOIN rent_bills rb ON rb.id = rbi.bill_id
          WHERE ${billCondition}
          AND rbi.status != 0
          AND DATE(rb.start_date) = CURRENT_DATE
        ) AS today_total_rent_items,
        (
          SELECT COALESCE(
            SUM((remark->>'qty')::numeric),
            0
          )
          FROM rent_bill_items rbi
          CROSS JOIN LATERAL jsonb_array_elements(rbi.remarks) remark
          JOIN rent_bills rb ON rb.id = rbi.bill_id
          WHERE ${billCondition}
          AND remark->>'action' = 'returned'
          AND DATE((remark->>'at')::timestamp) = CURRENT_DATE
        ) AS today_return_items_qty,
        (
          SELECT COALESCE(SUM(rp.amount),0)
          FROM rent_payments rp
          WHERE rp.branch_id = $1 AND cash_flow = 'in'
          AND DATE(rp.created_at) = CURRENT_DATE
        ) AS today_revenue,

        (
        SELECT COALESCE(SUM(rp.amount),0)
        FROM rent_payments rp
        WHERE rp.branch_id = $1 AND cash_flow = 'in'
        AND DATE_TRUNC('month', rp.created_at)
            = DATE_TRUNC('month', CURRENT_DATE)
       ) AS month_revenue,

        (
          SELECT COUNT(*)
          FROM customers c
          WHERE ${customerCondition}
          AND c.status = ${activeStatus}
        ) AS active_customers,

        (
          SELECT COUNT(*)
          FROM customers c
          WHERE ${customerCondition}
          AND c.status = ${blacklistStatus}
        ) AS blacklist_customers,

        (
          SELECT COALESCE(SUM(rs.available_units),0)
          FROM rental_stocks rs
          WHERE ${stockCondition}
          AND rs.status != 0
        ) AS total_available_quantity
    `;

      const result = await executeInTransaction(
        client,
        query,
        queryArgs
      );

      return result.rows[0];
    });
  }
  async getDailyCashFlow(data: {
    branch_id: number;
    month: number;
    year: number;
  }) {
    const { branch_id, month, year } = data;
    return transaction(async (client) => {

     const result= await executeInTransaction(client,
        `
    WITH daily_transactions AS (
      SELECT
        DATE(created_at) AS transaction_date,

        SUM(
          CASE
            WHEN cash_flow='in'
            THEN amount
            ELSE 0
          END
        ) AS income,

        SUM(
          CASE
            WHEN cash_flow='out'
            THEN amount
            ELSE 0
          END
        ) AS expense

      FROM rent_payments

      WHERE branch_id = $1
      AND EXTRACT(MONTH FROM created_at) = $2
      AND EXTRACT(YEAR FROM created_at) = $3
      AND status != 0

      GROUP BY DATE(created_at)
    )

    SELECT
      transaction_date AS date,
      COALESCE(income,0) AS income,
      COALESCE(expense,0) AS expense,
      COALESCE(income,0) - COALESCE(expense,0) AS balance

    FROM daily_transactions

    ORDER BY transaction_date
    `,
        [branch_id, month, year]
      );
      return result.rows
    })
  }
}