import { PoolClient } from "pg";
import { CreatePartyBalanceParams, DeletePartyBalanceParams, FetchDbPartyBalance, FetchPartyBalanceParams, PartyBalanceCountResult, RepayPartyBalanceParams } from "./partyBalance.types";
import { executeInTransaction, query } from "../../config/db";
import { getStatusCode, isExist } from "../../utils/extra";
import { AppError } from "../../utils/AppError";

export default class PartyBalanceService {

  async createPartyBalance(data: CreatePartyBalanceParams, client: PoolClient) {

    const { ref_id, ref_type, balance, flow, firm_id, remark, statusCode } = data;

    const partyQuery = `
      INSERT INTO party_balance (
        ref_id,
        ref_type,
        balance,
        paid,
        flow,
        firm_id,
        status,
        remarks
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const values = [
      ref_id,
      ref_type,
      balance,
      0,
      flow,
      firm_id,
      statusCode,
      JSON.stringify(remark),
    ];

    const { rows } = await executeInTransaction(client, partyQuery, values);
    return rows[0];
  }

  async fetchPartyBalance(data: FetchPartyBalanceParams) {

    const { filters, offset } = data;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`pb.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.id) {
      values.push(filters.id);
      where.push(`pb.id = $${values.length}`);
    }

    if (filters?.firm_id) {
      values.push(filters.firm_id);
      where.push(`pb.firm_id = $${values.length}`);
    }

    if (filters?.balance_amount_min) {
      values.push(filters.balance_amount_min);
      where.push(`pb.balance >= $${values.length}`);
    }

    if (filters?.balance_amount_max) {
      values.push(filters.balance_amount_max);
      where.push(`pb.balance <= $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const partyQuery = `
      SELECT 
        pb.*
      FROM party_balance pb
      ${whereClause}
      ORDER BY pb.id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM party_balance pb
      ${whereClause}
    `;

    const balances = await query<FetchDbPartyBalance>(
      partyQuery,
      [...values, filters.limit, offset]
    );

    const total = await query<PartyBalanceCountResult>(countQuery, values);

    return {
      balances,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / filters.limit),
      },
    };
  }

  async repayPartyBalance(data: RepayPartyBalanceParams, client: PoolClient) {

    const { PartyBalance_id, pay_amount, firm_id, remarks } = data;

    const balance = await isExist(
      PartyBalance_id,
      "party_balance",
      "firm_id",
      firm_id,
      client
    );

    if (!balance) {
      throw new AppError("Party balance not found", 404);
    }

    const remaining = Number(balance.balance) //- Number(balance.paid);

    if (pay_amount > remaining) {
      throw new AppError("Payment exceeds balance", 400);
    }

    const newPaid = Number(balance.paid) + Number(pay_amount);
    const newBalance = Number(balance.balance) - Number(pay_amount);

    const status =
      Number(newBalance)=== 0
        ? getStatusCode("Paid")
        : getStatusCode("Partial");

    const updateQuery = `
      UPDATE party_balance
      SET 
        paid = $1,
        remarks = CASE
          WHEN remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(remarks) = 'array'
            THEN remarks || $2::jsonb
          ELSE jsonb_build_array(remarks) || $2::jsonb
        END,
        status = $3,
        balance =$4
      WHERE id = $5
      RETURNING *;
    `;

    const { rows } = await executeInTransaction(client, updateQuery, [
      newPaid,
      JSON.stringify(remarks),
      status,
      newBalance,
      PartyBalance_id,
    ]);

    return rows[0];
  }

  async deletePartyBalance(data: DeletePartyBalanceParams, client: PoolClient) {

    const { id, firm_id } = data;

    const balance = await isExist(
      id,
      "party_balance",
      "firm_id",
      firm_id,
      client
    );

    if (!balance) {
      throw new AppError("Party balance not found", 404);
    }

    if (balance.paid > 0) {
      throw new AppError(
        "This record cannot be deleted because payment exists",
        400
      );
    }

    const deleteQuery = `
      UPDATE party_balance
      SET status = 0
      WHERE id = $1 AND firm_id =$2
      RETURNING *;
    `;

    const { rows } = await executeInTransaction(client, deleteQuery, [id,firm_id]);

    return rows[0];
  }
}