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
    return rows[0];
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

    // Loan amount filters
    if (filters?.loan_amount_min) {
      values.push(filters.loan_amount_min);
      where.push(`l.loan_amount >= $${values.length}`);
    }

    if (filters?.loan_amount_max) {
      values.push(filters.loan_amount_max);
      where.push(`l.loan_amount <= $${values.length}`);
    }

    // Paid amount filters
    if (filters?.paid_amount_min) {
      values.push(filters.paid_amount_min);
      where.push(`l.paid_amount >= $${values.length}`);
    }

    if (filters?.paid_amount_max) {
      values.push(filters.paid_amount_max);
      where.push(`l.paid_amount <= $${values.length}`);
    }

    // Balance amount filters
    if (filters?.balance_amount_min) {
      values.push(filters.balance_amount_min);
      where.push(`l.balance_amount >= $${values.length}`);
    }

    if (filters?.balance_amount_max) {
      values.push(filters.balance_amount_max);
      where.push(`l.balance_amount <= $${values.length}`);
    }

    // company filter (from branches table)
    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`b.company_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const loanQuery = `
  SELECT 
    l.*,
    b.branch_name
  FROM staff_loans l
  JOIN branches b ON b.id = l.branch_id
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

  // async updateloan(data: EditloanParams, client: any) {

  //   const { id, loan, description, company_id, statusCode } = data;

  //   const isloanExist = await getRecord(
  //     id,
  //     "loan",
  //     "company_id",
  //     company_id,
  //     client
  //   );

  //   if (!isloanExist) {
  //     throw new AppError("loan not found", 404);
  //   }

  //   const status =
  //     statusCode === 99
  //       ? isloanExist.status
  //       : statusCode;

  //   const updateQuery = `
  //     UPDATE loan
  //     SET
  //       loan = $1,
  //       description = $2,
  //       status = $3
  //     WHERE id = $4
  //     RETURNING *;
  //   `;

  //   const values = [
  //     loan ?? isloanExist.loan,
  //     description ?? isloanExist.description,
  //     status,
  //     id
  //   ];

  //   const { rows } = await executeInTransaction(client, updateQuery, values);

  //   return rows[0];
  // }

  async repayLoan(data: RepayLoanParams, client: PoolClient) {
    const { loan_id, pay_amount, branch_id, company_id, remarks } = data;

    // Get loan details
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

    return rows[0];
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
}