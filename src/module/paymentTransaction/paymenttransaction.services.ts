import { PoolClient } from "pg";
import { executeInTransaction, query } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { billStatus, getRecord, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { BulkEditPaymentRequest, CreatePaymentTransaction, DeletePaymentTransaction, EditPaymentTransaction, GetPaymentTransactions, PaymentRow, UpdatedPaymentMetadata } from "./paymenttransaction.types";
import { buildAuditChanges } from "../journal/journal.utils";

export class PaymentTransactionService {

  async insertPaymentTransaction(
    data: CreatePaymentTransaction,
    client: PoolClient
  ) {

    if (data.payment_method_id) {
      const isPaymentMethodExist = await getRecord(
        data.payment_method_id,
        "payment_methods",
        "company_id",
        data.company_id,
        client
      );

      if (!isPaymentMethodExist) {
        throw new AppError("Payment method not found", 404);
      }
    }
    const query = `
     INSERT INTO payment_transactions (
       ref_id,
       amount,
       ref_type,
       status,
       payment_method_id,
       transaction_reference,
       business_id,
       business_ref,company_id,payment_flow
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *;
   `;

    const values = [
      data.ref_id,
      data.amount,
      data.ref_type,
      data.status ?? 5,
      data.payment_method_id ?? null,
      data.transaction_reference ?? null,
      data.business_id,
      data.business_ref,
      data.company_id,
      data.payment_flow
    ];

    const result = await executeInTransaction(client, query, values);

    return result.rows[0];
  }
  async syncPaymentTransactions(
    params: {
      ref_id: number;
      company_id: number;
      firm_id: number;
      statusCode: number;
      entity_type: string;
      payments: { id?: number | null; payment_method_id: number; amount: number; transaction_reference?: string | null, payment_flow?: "I" | "E" }[];
      ref_type: string
    },
    client: PoolClient
  ) {
    const { ref_id, company_id, firm_id, statusCode, entity_type, payments, ref_type } = params;

    // 1. Validate active target payment methods layout linkage records
    for (const p of payments) {
      if (p.payment_method_id) {
        const isPaymentMethodExist = await getRecord(
          p.payment_method_id,
          "payment_methods",
          "company_id",
          company_id,
          client
        );
        if (!isPaymentMethodExist) {
          throw new AppError(`Payment method ${p.payment_method_id} not found`, 404);
        }
      }
    }

    // 2. Filter explicit transactional tracking identities
    const incomingTxIds = payments.map((p) => p.id).filter((id): id is number => !!id);

    // 3. Soft Delete Removed Rows: Set status to 0 instead of running a hard table purge block
    if (incomingTxIds.length > 0) {
      await executeInTransaction(
        client,
        `UPDATE payment_transactions 
         SET status = 0 
         WHERE ref_id = $1 
           AND ref_type = $2 
           AND company_id = $3 
           AND id NOT IN (${incomingTxIds.map((_, i) => `$${i + 4}`).join(",")})`,
        [ref_id, ref_type, company_id, ...incomingTxIds]
      );
    } else {
      // Set status to 0 across all past records if no specific transactional mappings were assigned
      await executeInTransaction(
        client,
        `UPDATE payment_transactions 
         SET status = 0 
         WHERE ref_id = $1 AND ref_type = $2 AND company_id = $3`,
        [ref_id, ref_type, company_id]
      );
    }

    // 4. Update remaining lines or create fresh ledger balance nodes
    for (const p of payments) {
      if (p.id) {
        await executeInTransaction(
          client,
          `UPDATE payment_transactions 
           SET amount = $1, payment_method_id = $2, transaction_reference = $3, status = $4
           WHERE id = $5 AND company_id = $6 AND ref_id = $7`,
          [p.amount, p.payment_method_id, p.transaction_reference ?? null, statusCode, p.id, company_id, ref_id]
        );
      } else if (p.amount > 0) {
        await executeInTransaction(
          client,
          `INSERT INTO payment_transactions (
            ref_id, amount, ref_type, status, payment_method_id, 
            transaction_reference, business_id, business_ref, company_id, payment_flow
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            ref_id,
            p.amount,
            ref_type,
            statusCode,
            p.payment_method_id,
            p.transaction_reference ?? null,
            firm_id,
            entity_type,
            company_id,
            p.payment_flow
          ]
        );
      }
    }
  }
 async editPaymentTransactions(
  data: BulkEditPaymentRequest & { firm_id: number },
  client: PoolClient
): Promise<void> {
  const { company_id, firm_id, payments } = data;

  for (const p of payments) {
    // 1. Validate target payment method if changed
    if (p.payment_method_id) {
      const isPaymentMethodExist = await getRecord(
        p.payment_method_id,
        "payment_methods",
        "company_id",
        company_id,
        client
      );
      if (!isPaymentMethodExist) {
        throw new AppError(`Payment method ${p.payment_method_id} not found`, 404);
      }
    }
    
    // 2. Fetch current transaction including its payment_flow ("I" or "E")
    const currentTxRes = await client.query(
      `SELECT amount, status, ref_id, ref_type, payment_flow 
       FROM payment_transactions 
       WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [p.payment_id, company_id]
    );

    if (currentTxRes.rows.length === 0) {
      throw new AppError(`Payment transaction record ${p.payment_id} not found`, 404);
    }

    const oldTx = currentTxRes.rows[0];
    const oldAmount = Number(oldTx.amount);
    const oldStatus = Number(oldTx.status);
    const paymentFlow = oldTx.payment_flow; // "I" (Income) or "E" (Expense)

    const newAmount = p.amount !== undefined ? Number(p.amount) : oldAmount;
    const newStatus = p.status !== undefined ? Number(p.status) : oldStatus;

    // 3. Compute raw cash contribution variance (Delta)
    const oldContribution = oldStatus === 0 ? 0 : oldAmount; // Status 0 = deleted/inactive
    const newContribution = newStatus === 0 ? 0 : newAmount;
    const rawDelta = newContribution - oldContribution;

    // 4. Update the payment_transactions record
    const updateFields: string[] = [];
    const queryValues: (string | number | null)[] = [];

    if (p.amount !== undefined) {
      queryValues.push(p.amount);
      updateFields.push(`amount = $${queryValues.length}`);
    }
    if (p.payment_method_id !== undefined) {
      queryValues.push(p.payment_method_id);
      updateFields.push(`payment_method_id = $${queryValues.length}`);
    }
    if (p.transaction_reference !== undefined) {
      queryValues.push(p.transaction_reference);
      updateFields.push(`transaction_reference = $${queryValues.length}`);
    }
    if (p.status !== undefined) {
      queryValues.push(p.status);
      updateFields.push(`status = $${queryValues.length}`);
    }

    if (updateFields.length > 0) {
      queryValues.push(p.payment_id, company_id, firm_id);
      const idIdx = queryValues.length - 2;
      const companyIdx = queryValues.length - 1;
      const firmIdx = queryValues.length;

      const queryText = `
        UPDATE payment_transactions 
        SET ${updateFields.join(", ")} 
        WHERE id = $${idIdx} AND company_id = $${companyIdx} AND business_id = $${firmIdx} AND business_ref = 'F'
      `;
      await client.query(queryText, queryValues);
    }

    // 5. 🚀 Apply Directional Delta to parent documents based on payment_flow ("I" vs "E")
    if (rawDelta !== 0) {
      const refId = oldTx.ref_id;
      const refType = oldTx.ref_type; // Database short codes: SL, ST, SR, PS, PT, PR

      // CASE A: Sales & Sale Settlements (SL, ST)
      if (refType === "SL" || refType === "ST") {
        // Normal Sale payment is Income ("I"). An Expense ("E") flow on a Sale is a refund to customer.
        const directionalDelta = paymentFlow === "E" ? -rawDelta : rawDelta;
        
        const parentRes = await client.query(`SELECT final_amount, paid FROM sales WHERE id = $1 FOR UPDATE`, [refId]);
        if (parentRes.rows.length > 0) {
          const nextPaid = Number(parentRes.rows[0].paid) + directionalDelta;
          await client.query(
            `UPDATE sales SET paid = $1, status = $2 WHERE id = $3`,
            [nextPaid, billStatus(parentRes.rows[0].final_amount, nextPaid), refId]
          );
        }
      }

      // CASE B: Sale Returns (SR)
      else if (refType === "SR") {
        // Normal Return payout is Expense ("E"). An Income ("I") flow is customer paying back over-refund.
        const directionalDelta = paymentFlow === "I" ? -rawDelta : rawDelta;

        const parentRes = await client.query(`SELECT final_amount, paid_amount FROM sale_return WHERE id = $1 FOR UPDATE`, [refId]);
        if (parentRes.rows.length > 0) {
          const nextPaid = Number(parentRes.rows[0].paid_amount) + directionalDelta;
          await client.query(
            `UPDATE sale_return SET paid_amount = $1, status = $2 WHERE id = $3`,
            [nextPaid, billStatus(parentRes.rows[0].final_amount, nextPaid), refId]
          );
        }
      }

      // CASE C: Purchases & Purchase Settlements (PS, PT)
      else if (refType === "PS" || refType === "PT") {
        // Normal Purchase payment is Expense ("E"). An Income ("I") flow is vendor refunding us.
        const directionalDelta = paymentFlow === "I" ? -rawDelta : rawDelta;

        const parentRes = await client.query(`SELECT final_amount, paid_amount FROM purchases WHERE id = $1 FOR UPDATE`, [refId]);
        if (parentRes.rows.length > 0) {
          const nextPaid = Number(parentRes.rows[0].paid_amount) + directionalDelta;
          await client.query(
            `UPDATE purchases SET paid_amount = $1, status = $2 WHERE id = $3`,
            [nextPaid, billStatus(parentRes.rows[0].final_amount, nextPaid), refId]
          );
        }
      }

      // CASE D: Purchase Returns (PR)
      else if (refType === "PR") {
        // Normal Purchase Return refund is Income ("I"). An Expense ("E") flow is paying back over-refund.
        const directionalDelta = paymentFlow === "E" ? -rawDelta : rawDelta;

        const parentRes = await client.query(`SELECT final_amount, refund_amount FROM purchase_return WHERE id = $1 FOR UPDATE`, [refId]);
        if (parentRes.rows.length > 0) {
          const nextPaid = Number(parentRes.rows[0].refund_amount) + directionalDelta;
          await client.query(
            `UPDATE purchase_return SET refund_amount = $1, status = $2 WHERE id = $3`,
            [nextPaid, billStatus(parentRes.rows[0].final_amount, nextPaid), refId]
          );
        }
      }
    }
  }
}
  async editSinglePaymentTransaction(data: EditPaymentTransaction, client: PoolClient) {
    const {
      company_id,
      amount,
      payment_method_id,
      ref_id,
      ref_type,
      status,
      transaction_reference,
      business_id, business_ref
    } = data;
    const payment_exist = await executeInTransaction(
      client,
      `SELECT * FROM payment_transactions
     WHERE company_id = $1
     AND ref_type = $2
     AND status != $3
     AND ref_id = $4
     AND business_ref = $5
      AND business_id = $6`,
      [company_id, ref_type, 0, ref_id, business_ref, business_id]
    );

    const payment = payment_exist.rows[0];

    if (!payment) {
      throw new AppError("Payment transaction not found", 404);
    }
    if (!payment && status === 5) {
      await executeInTransaction(
        client,
        `INSERT INTO payment_transactions
      (ref_id, amount, ref_type, status, payment_method_id,
       transaction_reference, business_id, business_ref, company_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          ref_id,
          amount,
          ref_type,
          status,
          payment_method_id,
          transaction_reference,
          business_id,
          business_ref,
          company_id
        ]
      );
    }
    else if (payment && status === 5) {
      await executeInTransaction(
        client,
        `UPDATE payment_transactions
       SET amount=$1,
           payment_method_id=$2,
           transaction_reference=$3
       WHERE id=$4`,
        [
          amount,
          payment_method_id,
          transaction_reference,
          payment.id
        ]
      );
    }
  }
  async upsertPaymentTransaction(
    data: CreatePaymentTransaction,
    client: PoolClient
  ) {
    if (data.payment_method_id) {
      const paymentMethod = await getRecord(
        data.payment_method_id,
        "payment_methods",
        "company_id",
        data.company_id,
        client
      );

      if (!paymentMethod) {
        throw new AppError("Payment method not found", 404);
      }
    }

    const existing = await executeInTransaction(
      client,
      `
    SELECT id
    FROM payment_transactions
    WHERE company_id = $1
      AND ref_id = $2
      AND ref_type = $3
      AND business_id = $4
      AND business_ref = $5
      AND payment_flow = $6
    LIMIT 1
    `,
      [
        data.company_id,
        data.ref_id,
        data.ref_type,
        data.business_id,
        data.business_ref,
        data.payment_flow
      ]
    );
    if ((existing.rowCount ?? 0) > 0) {
      if (existing.rows[0].payment_method_id === data.payment_method_id) {
        const result = await executeInTransaction(
          client,
          `
      UPDATE payment_transactions
      SET
        amount = amount+$1,
        payment_method_id = $2,
        transaction_reference = $3
      WHERE id = $4
      RETURNING *;
      `,
          [
            data.amount,
            data.payment_method_id ?? null,
            data.transaction_reference ?? null,
            existing.rows[0].id,
          ]
        );

        return result.rows[0];
      }
    }

    const result = await executeInTransaction(
      client,
      `
    INSERT INTO payment_transactions (
      ref_id,
      amount,
      ref_type,
      status,
      payment_method_id,
      transaction_reference,
      business_id,
      business_ref,
      company_id,
      payment_flow
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *;
    `,
      [
        data.ref_id,
        data.amount,
        data.ref_type,
        data.status ?? 5,
        data.payment_method_id ?? null,
        data.transaction_reference ?? null,
        data.business_id,
        data.business_ref,
        data.company_id,
        data.payment_flow,
      ]
    );
    const changes = buildAuditChanges(existing, result.rows[0]);
    return { data: result.rows[0], changes };
  }
  async deletePaymentTransaction(data: DeletePaymentTransaction, client: PoolClient) {
    const { company_id, ref_id, ref_type } = data;

    const result = await executeInTransaction(
      client,
      `UPDATE payment_transactions
     SET status = 0
     WHERE company_id = $1
     AND ref_type = $2
     AND ref_id = $3
     AND status != 0`,
      [company_id, ref_type, ref_id]
    );

    return result.rowCount;
  }
  async fetchPayments(data: GetPaymentTransactions) {
    const { filters, offset } = data;
    const limit = filters.limit ?? 20;
    const page = filters.page ?? 1;
    const where: string[] = [];
    const values: any[] = [];

    // Exclude deleted/inactive records
    where.push(`pt.status != $${values.length + 1}`);
    values.push(0);

    if (filters?.company_id) {
      values.push(filters.company_id);
      where.push(`b.company_id = $${values.length}`);
    }

    if (filters?.branch_id) {
      values.push(filters.branch_id);
      where.push(`f.branch_id = $${values.length}`);
    }

    if (filters.firm_id) {
      values.push(filters.firm_id);
      where.push(`pt.business_id = $${values.length}`);

      values.push("F");
      where.push(`pt.business_ref = $${values.length}`);
    }

    if (filters?.payment_method_id) {
      values.push(filters.payment_method_id);
      where.push(`pt.payment_method_id = $${values.length}`);
    }

    if (filters.ref_id) {
      values.push(filters.ref_id);
      where.push(`pt.ref_id = $${values.length}`);
    }
    if (filters.ref_type && filters.ref_type.length > 0) {
      const placeholders = filters.ref_type.map((_, i) => `$${values.length + i + 1}`).join(", ");
      values.push(...filters.ref_type);
      where.push(`pt.ref_type IN (${placeholders})`);
    }

    if (filters?.payment_flow) {
      values.push(filters.payment_flow);
      where.push(`pt.payment_flow = $${values.length}`);
    }

    if (filters?.start_date) {
      values.push(filters.start_date);
      where.push(`pt.created_at >= $${values.length}`);
    }

    if (filters?.end_date) {
      values.push(filters.end_date);
      where.push(`pt.created_at <= $${values.length}`);
    }


    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const paymentQuery = `
    SELECT
      pt.*,
      pm.method_name AS payment_method,
      f.branch_id,
      b.company_id

    FROM payment_transactions pt

    LEFT JOIN payment_methods pm
      ON pm.id = pt.payment_method_id

   LEFT JOIN firm f
  ON f.id = pt.business_id
 AND pt.business_ref = 'F'

    LEFT JOIN branches b
      ON b.id = f.branch_id

    ${whereClause}

    ORDER BY pt.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*)
    FROM payment_transactions pt

    LEFT JOIN payment_methods pm
      ON pm.id = pt.payment_method_id

  LEFT JOIN firm f
  ON f.id = pt.business_id
 AND pt.business_ref = 'F'

    LEFT JOIN branches b
      ON b.id = f.branch_id

    ${whereClause}
  `;

    const payments = await query<PaymentRow>(
      paymentQuery,
      [...values, limit, offset]
    );

    const total = await query<{ count: string }>(countQuery, values);
    return {
      payments,
      pagination: {
        page: page,
        limit: limit,
        total: Number(total[0].count),
        totalPages: Math.ceil(Number(total[0].count) / limit || 20),
      },
    };
  }
}