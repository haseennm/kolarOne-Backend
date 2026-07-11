import { PoolClient } from "pg";
import { executeInTransaction, query, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getStatusCode, getRecord } from "../../utils/extra";
import { CreateLoanParams, DeleteLoanBody, DeleteLoanParams, FetchDbLoan, FetchLoanParams, LoanCountResult, RepayLoanParams } from "./loan.types";


export default class LoanService {

  async createLoan(data: CreateLoanParams, client: PoolClient) {

    const { branch_id, loan_amount, remark, staff_id, statusCode, company_id } = data;

    const is_staff_exist = await getRecord(
      staff_id,
      "staff",
      "company_id",
      company_id,
      client
    );

    if (!is_staff_exist) {
      throw new AppError("Company not found", 404);
    }

    const loanQuery = `
      INSERT INTO staff_loans (
        branch_id,
        loan_amount,
        remarks,
        staff_id,
        balance_amount,
        paid_amount,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;

    const values = [
      branch_id,
      loan_amount,
      JSON.stringify(remark),
      staff_id,
      loan_amount,
      0,
      statusCode
    ];

    const { rows } = await executeInTransaction(client, loanQuery, values);
    const createdLoan = rows[0];

    const staffQuery = `
      SELECT s.full_name AS staff_name
      FROM staff s
      WHERE s.id = $1
    `;

    const staffResult = await executeInTransaction(client, staffQuery, [createdLoan.staff_id]);
    const staffName = staffResult.rows[0]?.staff_name ?? null;

    return {
      ...createdLoan,
      staff_name: staffName,
    };
  }

  async fetchLoan(data: FetchLoanParams) {
    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`l.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`l.id = $${values.length}`);
    }

    if (filters?.staff_id) {
      values.push(filters.staff_id);
      where.push(`l.staff_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`l.branch_id = $${values.length}`);
    }

    if (filters?.loan_amount_min) {
      values.push(filters.loan_amount_min);
      where.push(`l.loan_amount >= $${values.length}`);
    }

    if (filters?.loan_amount_max) {
      values.push(filters.loan_amount_max);
      where.push(`l.loan_amount <= $${values.length}`);
    }

    if (filters?.paid_amount_min) {
      values.push(filters.paid_amount_min);
      where.push(`l.paid_amount >= $${values.length}`);
    }

    if (filters?.paid_amount_max) {
      values.push(filters.paid_amount_max);
      where.push(`l.paid_amount <= $${values.length}`);
    }

    if (filters?.balance_amount_min) {
      values.push(filters.balance_amount_min);
      where.push(`l.balance_amount >= $${values.length}`);
    }

    if (filters?.balance_amount_max) {
      values.push(filters.balance_amount_max);
      where.push(`l.balance_amount <= $${values.length}`);
    }

    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`b.company_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const loanQuery = `
  SELECT 
    l.*,
    b.branch_name,
    s.full_name AS staff_name,
    s.entity_type,   -- ✅ add this

    CASE 
      WHEN s.entity_type = 'C' THEN c.company_name
      WHEN s.entity_type = 'B' THEN b2.branch_name
      WHEN s.entity_type = 'F' THEN f.firm_name
      ELSE NULL
    END AS entity_name

  FROM staff_loans l

  JOIN branches b ON b.id = l.branch_id
  JOIN staff s ON s.id = l.staff_id

  LEFT JOIN company c ON c.id = s.entity_id AND s.entity_type = 'C'
  LEFT JOIN branches b2 ON b2.id = s.entity_id AND s.entity_type = 'B'
  LEFT JOIN firm f ON f.id = s.entity_id AND s.entity_type = 'F'

  ${whereClause}

  ORDER BY l.id DESC
  LIMIT $${values.length + 1}
  OFFSET $${values.length + 2}
`;

    const countQuery = `
    SELECT COUNT(*)
    FROM staff_loans l
    JOIN branches b ON b.id = l.branch_id
    ${whereClause}
  `;

    const loans = await query<FetchDbLoan>(
      loanQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<LoanCountResult>(countQuery, values);

    return {
      loans,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }



  async repayLoan(data: RepayLoanParams, client: PoolClient) {
    const { loan_id, pay_amount, branch_id, company_id, remarks } = data;

    const loan = await getRecord(loan_id, "staff_loans", "branch_id", branch_id, client)

    if (!loan) {
      throw new AppError("Loan not found", 404);
    }
    if (pay_amount > loan.balance_amount) {
      throw new AppError("Payment exceeds balance amount", 400);
    }

    const newPaidAmount = Number(loan.paid_amount) + Number(pay_amount);
    const newBalanceAmount = Number(loan.balance_amount) - Number(pay_amount);

    const status = newBalanceAmount === 0 ? getStatusCode("Closed") : getStatusCode("Partial");

    const updateQuery = `
    UPDATE staff_loans
    SET 
      paid_amount = $1,
      balance_amount = $2,
      remarks = CASE
      WHEN remarks IS NULL THEN $3::jsonb
      WHEN jsonb_typeof(remarks) = 'array'
        THEN remarks || $3::jsonb
      ELSE jsonb_build_array(remarks) || $3::jsonb
    END,
      status = $4
    WHERE id = $5
    RETURNING *;
  `;

    const { rows } = await executeInTransaction(client, updateQuery, [
      newPaidAmount,
      newBalanceAmount,
      JSON.stringify(remarks),
      status,
      loan_id,
    ]);
    const staffQuery = `
      SELECT s.full_name AS staff_name
      FROM staff s
      WHERE s.id = $1
    `;

    const staffResult = await executeInTransaction(client, staffQuery, [rows[0].staff_id]);
    const staffName = staffResult.rows[0]?.staff_name ?? null;

    return {
      ...rows[0],
      staff_name: staffName,
    };
  }
  async deleteLoan(data: DeleteLoanParams, client: PoolClient) {

    const { id, branch_id } = data;
    const isLoan_exist = await getRecord(
      id,
      "staff_loans",
      "branch_id",
      branch_id,
      client
    );

    if (!isLoan_exist) {
      throw new AppError("Loan not found or already deleted", 404);
    }
    if (isLoan_exist.paid_amount > 0) {
      throw new AppError("This loan cannot be modified because a payment has already been made", 400);
    }

    const deleteQuery = `
        UPDATE staff_loans
        SET status = 0
        WHERE id = $1
        RETURNING *;
      `;

    const { rows } = await executeInTransaction(
      client,
      deleteQuery,
      [id]
    );

    return rows[0];

  }

  async getLoanReport(data: {
    level: "branch" | "company";
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
  }) {

    const { level, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {

      let branchIds: number[] = [];

      /* ================= RESOLVE BRANCH IDS ================= */

      if (level === "branch") {
        branchIds = [branch_id!];
      }

      if (level === "company") {
        const branches = await executeInTransaction(
          client,
          `SELECT id FROM branches WHERE company_id = $1`,
          [company_id]
        );

        branchIds = branches.rows.map((b: any) => b.id);
      }

      if (!branchIds.length) return {};

      /* ================= DATE FILTER ================= */

      const paramsBase = [
        branchIds,
        start_date ?? null,
        end_date ?? null
      ];

      const dateFilter = `
        AND (
          $2::date IS NULL OR $3::date IS NULL OR
          TO_TIMESTAMP(
            (
              SELECT (elem->>'created_at')::BIGINT
              FROM jsonb_array_elements(
  CASE 
    WHEN jsonb_typeof(l.remarks) = 'array' THEN l.remarks
    ELSE jsonb_build_array(l.remarks)
  END
) elem
              WHERE elem ? 'created_at'
              LIMIT 1
            ) / 1000
          ) BETWEEN $2 AND $3
        )
      `;

      /* ================= SUMMARY ================= */

      const summary = await executeInTransaction(
        client,
        `
        SELECT
          COALESCE(SUM(l.loan_amount), 0) AS total_loan_amount,
          COALESCE(SUM(l.loan_amount - l.balance_amount), 0) AS total_received_amount,
          COALESCE(SUM(l.balance_amount), 0) AS total_difference
        FROM staff_loans l
        WHERE l.branch_id = ANY($1)
        ${dateFilter}
        `,
        paramsBase
      );

      /* ================= STAFF COUNT ================= */

      const staffCount = await executeInTransaction(
        client,
        `
        SELECT COUNT(DISTINCT l.staff_id) AS staff_count
        FROM staff_loans l
        WHERE l.branch_id = ANY($1)
        ${dateFilter}
        `,
        paramsBase
      );

      /* ================= HIGHEST BALANCE ================= */

      const highestBalance = await executeInTransaction(
        client,
        `
        SELECT s.full_name, SUM(l.balance_amount) AS balance
        FROM staff_loans l
        JOIN staff s ON s.id = l.staff_id
        WHERE l.branch_id = ANY($1)
        GROUP BY l.staff_id, s.full_name
        ORDER BY balance DESC
        LIMIT 1
        `,
        [branchIds]
      );

      /* ================= BIGGEST LOAN ================= */

      const biggestLoan = await executeInTransaction(
        client,
        `
        SELECT s.full_name, MAX(l.loan_amount) AS max_loan
        FROM staff_loans l
        JOIN staff s ON s.id = l.staff_id
        WHERE l.branch_id = ANY($1)
        GROUP BY l.staff_id, s.full_name
        ORDER BY max_loan DESC
        LIMIT 1
        `,
        [branchIds]
      );

      /* ================= DEFAULTERS ================= */

      const defaulters = await executeInTransaction(
        client,
        `
        SELECT
          s.full_name,
          l.loan_amount,
          l.balance_amount,
          TO_TIMESTAMP(
            (
              SELECT (elem->>'created_at')::BIGINT
              FROM jsonb_array_elements(
  CASE 
    WHEN jsonb_typeof(l.remarks) = 'array' THEN l.remarks
    ELSE jsonb_build_array(l.remarks)
  END
) elem
              WHERE elem ? 'created_at'
              LIMIT 1
            ) / 1000
          ) AS created_at
        FROM staff_loans l
        JOIN staff s ON s.id = l.staff_id
        WHERE l.branch_id = ANY($1)
          AND l.balance_amount > 0
          AND TO_TIMESTAMP(
            (
              SELECT (elem->>'created_at')::BIGINT
              FROM jsonb_array_elements(
  CASE 
    WHEN jsonb_typeof(l.remarks) = 'array' THEN l.remarks
    ELSE jsonb_build_array(l.remarks)
  END
) elem
              WHERE elem ? 'created_at'
              LIMIT 1
            ) / 1000
          ) <= NOW() - INTERVAL '3 months'
        `,
        [branchIds]
      );

      /* ================= COMPANY EXTRA ================= */

      if (level === "company") {

        const branchWise = await executeInTransaction(
          client,
          `
          SELECT 
            b.id AS branch_id,
            b.branch_name,
            COALESCE(SUM(l.loan_amount),0) AS total_loan
          FROM branches b
          LEFT JOIN staff_loans l ON l.branch_id = b.id
          WHERE b.id = ANY($1)
          GROUP BY b.id
          `,
          [branchIds]
        );

        return {
          summary: summary.rows[0],
          staff_count: Number(staffCount.rows[0].staff_count),
          highest_balance_holder: highestBalance.rows[0] || null,
          biggest_loan_taker: biggestLoan.rows[0] || null,
          defaulters: defaulters.rows,
          branch_wise: branchWise.rows
        };
      }

      /* ================= FINAL RESPONSE ================= */

      return {
        summary: summary.rows[0],
        staff_count: Number(staffCount.rows[0].staff_count),
        highest_balance_holder: highestBalance.rows[0] || null,
        biggest_loan_taker: biggestLoan.rows[0] || null,
        defaulters: defaulters.rows
      };
    });
  }
}
