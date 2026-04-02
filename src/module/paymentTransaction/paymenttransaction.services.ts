import { executeInTransaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { cns, getRecord } from "../../utils/extra";
import { CreatePaymentTransaction, DeletePaymentTransaction, EditPaymentTransaction } from "./paymenttransaction.types";

export class PaymentTransactionService {

  async insertPaymentTransaction(
    data: CreatePaymentTransaction,
    client: any
  ) {
    cns("payment inserting", data)

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
       business_ref,company_id
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
      data.company_id
    ];

    const result = await executeInTransaction(client, query, values);

    return result.rows[0];
  }

  async editPaymentTransaction(data: EditPaymentTransaction, client: any) {
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
    cns("chaek",[company_id, ref_type, 0, ref_id, business_ref, business_id]
)
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

  async deletePaymentTransaction(data: DeletePaymentTransaction, client: any) {
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
}