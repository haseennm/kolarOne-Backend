import { PoolClient } from "pg";
import { CreateAdvanceParams, CreateRentLossBody, CreateRentPaymentParams, DeleteLossRentBody, FetchLossRentParams, PayLostBillBody } from "./rentLoss.types";
import { executeInTransaction, pool } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord, getStatusCode } from "../../utils/extra";

export class RentLossService {

  private async validateStockAvailability(
    rent_stock_id: number,
    qty: number,
    branch_id: number,
    client: PoolClient
  ): Promise<void> {


    if (qty <= 0) {
      throw new AppError(
        "Quantity taken must be greater than 0", 400
      );
    }

    const stockResult = await executeInTransaction(
      client,
      `
      SELECT
        id,
        unique_name,
        available_units,
        status
      FROM rental_stocks
      WHERE id = $1
      AND branch_id = $2
      AND status != $3
      `,
      [
        rent_stock_id,
        branch_id,
        getStatusCode("Deleted")
      ]
    );

    const stock = stockResult.rows[0];

    if (!stock) {
      throw new AppError(
        `Rental stock ${rent_stock_id} not found`, 404
      );
    }

    if (
      stock.available_units <
      qty
    ) {
      throw new AppError(
        `${stock.unique_name} has only ${stock.available_units} units available`, 400
      );
    }

  }
  private appendRemark(
    remarks: any[] | null,
    action: string,
    data: Record<string, any> = {}
  ) {
    const existingRemarks = Array.isArray(remarks)
      ? remarks
      : [];

    existingRemarks.push({
      action,
      at: new Date().toISOString(),
      ...data
    });

    return existingRemarks;
  }

  private async validateAdvanceBalance(
    ledger_id: number,
    amount: number,
    branch_id: number,
    client: PoolClient
  ) {
    const ledger = await getRecord(
      ledger_id,
      "rent_customer_ledger",
      "branch_id",
      branch_id,
      client
    )
    // const result = await executeInTransaction(
    //   client,
    //   `
    // SELECT *
    // FROM rent_customer_ledger
    // WHERE id = $1
    // AND branch_id = $2
    // AND status != $3
    // `,
    //   [
    //     ledger_id,
    //     branch_id,
    //     getStatusCode("Deleted")
    //   ]
    // );

    // const ledger = result.rows[0];

    if (!ledger) {
      throw new AppError(
        "Advance ledger not found", 404
      );
    }

    if (amount <= 0) {
      throw new AppError(
        "Amount must be greater than 0", 404
      );
    }

    if (Number(ledger.remaining_amount) < Number(amount)) {
      throw new AppError(
        `Insufficient advance balance. Available balance: ${ledger.remaining_amount}, requested amount: ${amount}.`,
        400
      );
    }

    return ledger;
  }
  private async generatePaymentStatus(
    amount: number,
    paid: number
  ) {
    if (Number(amount) === Number(paid)) return getStatusCode("Paid")
    if (Number(paid) > 0 && Number(amount) > Number(paid)) return getStatusCode("Partial")
    if (0 === Number(paid)) return getStatusCode("Unpaid")
    return getStatusCode("Unpaid")
  }

  private async createRentPayment(
    params: CreateRentPaymentParams,
    client: PoolClient
  ) {
    const {
      branch_id,
      amount,
      payment_method_id,
      row_type,
      row_id,
      cash_flow,
      note = null,
      remarks = [],
      status = getStatusCode("Active")
    } = params;

    const prefix =
      cash_flow === "in"
        ? "REC"
        : "VOU";

    const sequenceName =
      cash_flow === "in"
        ? "receipt_seq"
        : "voucher_seq";

    const seqResult = await executeInTransaction(
      client,
      `
    SELECT nextval('${sequenceName}') AS seq
    `
    );

    const seq = Number(seqResult.rows[0].seq);

    const year = new Date().getFullYear();

    const ref_no =
      `${prefix}-${branch_id}${year}-${String(seq).padStart(4, "0")}`;

    const result = await executeInTransaction(
      client,
      `
    INSERT INTO rent_payments (
      ref_no,
      branch_id,
      amount,
      payment_method_id,
      row_type,
      row_id,
      cash_flow,
      note,
      remarks,
      status
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
    )
    RETURNING *
    `,
      [
        ref_no,
        branch_id,
        amount,
        payment_method_id,
        row_type,
        row_id,
        cash_flow,
        note,
        JSON.stringify(remarks),
        status
      ]
    );

    return result.rows[0];
  }
  async createAdvance(
    params: CreateAdvanceParams,
    client: PoolClient
  ) {
    const {
      customer_id,
      branch_id,
      amount,
      payment_method_id,
      note,
      company_id
    } = params;

    if (amount <= 0) {
      throw new AppError(
        "Advance amount must be greater than zero",
        400
      );
    }

    const customer = await getRecord(
      customer_id,
      "customers",
      "company_id",
      company_id,
      client
    );

    if (!customer) {
      throw new AppError(
        "Customer not found",
        404
      );
    }

    const paymentMethod = await getRecord(
      payment_method_id,
      "payment_methods",
      "company_id",
      company_id,
      client
    );

    if (!paymentMethod) {
      throw new AppError(
        "Payment method not found",
        404
      );
    }

    const remarks = [
      {
        action: "advance_created",
        amount,
        note,
        at: new Date().toISOString()
      }
    ];

    const ledgerResult = await executeInTransaction(
      client,
      `
    INSERT INTO rent_customer_ledger (
      customer_id,
      branch_id,
      amount,
      remaining_amount,
      payment_method_id,
      remarks,
      status
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7
    )
    RETURNING *
    `,
      [
        customer_id,
        branch_id,
        amount,
        amount,
        payment_method_id,
        JSON.stringify(remarks),
        getStatusCode("Active")
      ]
    );

    const ledger = ledgerResult.rows[0];

    //     await this.createRentPayment(
    //   {
    //     branch_id,
    //     amount,
    //     payment_method_id,
    //     row_type: "advance",
    //     row_id: ledger.id,
    //     cash_flow: "in",
    //     note,
    //     remarks: [
    //       {
    //         action: "advance_created",
    //         at: new Date().toISOString()
    //       }
    //     ]
    //   },
    //   client
    // );

    return ledger;
  }
  async createRentLoss(
    params: CreateRentLossBody,
    client: PoolClient
  ) {
    const {
      branch_id,
      amount,
      paid,
      payment_method_id,
      product_id,
      isbyCustomer,
      quantity,
      reason,
      rent_stock_id,
      company_id,
      customer_id,
      created_by
    } = params;

    const rent_stock = await getRecord(
      rent_stock_id,
      "rental_stocks",
      "branch_id",
      branch_id,
      client
    );
    if (!rent_stock) {
      throw new AppError(
        "rent stock not found",
        404
      );
    }
    if (Number(rent_stock.product_id) !== Number(product_id))

      throw new AppError(
        "Product Not matching with this stock",
        404
      );

    let responsible_type = null
    if (isbyCustomer) {
      if (!customer_id) {
        throw new AppError("customer is require. ", 400)
      }
      responsible_type = "customer"
      const customer = await getRecord(
        customer_id,
        "customers",
        "company_id",
        company_id,
        client
      );
      if (!customer) {
        throw new AppError(
          "Customer not found",
          404
        );
      }
      // if (
      //   customer.status ===
      //   getStatusCode("Blacklist")
      // ) {
      //   throw new AppError(
      //     "Customer is blacklisted",
      //     400
      //   );
      // }
    } else {
      responsible_type = "branch"
    }



    await this.validateStockAvailability(
      rent_stock_id,
      quantity,
      branch_id,
      client
    );
    const payment_status = await this.generatePaymentStatus(amount, paid || 0)
    const remarks = this.appendRemark(null, "Created", { created_by: created_by })

    await executeInTransaction(
      client,
      `
    UPDATE rental_stocks
    SET
      available_units = available_units - $1,
      remarks = $2
    WHERE id = $3
    `,
      [
        Number(quantity),
        JSON.stringify([

          {
            action: "Moved to loss stock",
            quantity,
            at: new Date().toISOString()
          }
        ]),
        rent_stock_id
      ]
    );
    const lost_stockResult =
      await executeInTransaction(
        client,
        `
INSERT INTO loss_stocks (
    product_id,
    rent_stock_id,
    quantity,
    amount,
    customer_id,
    status,
    payment_status,
    remarks,
    paid,
    branch_id,
    responsible_type 
)
VALUES (
    $1, -- product_id
    $2, -- rent_stock_id
    $3, -- quantity
    $4, -- amount
    $5, -- responsible_by
    $6, -- status
    $7, -- payment_status
    $8, -- remarks
    $9, -- paid
    $10, -- branch_id
    $11
)
RETURNING *;
`,
        [
          product_id,
          rent_stock_id,
          quantity,
          amount,
          customer_id || null,
          getStatusCode(reason),
          payment_status,
          JSON.stringify(remarks),
          paid || 0,
          branch_id,
          responsible_type
        ]
      );

    const lost_stock = lost_stockResult.rows[0];


    if (paid) {
      if (
        paid > 0
      ) {
        if (!payment_method_id) {
          throw new AppError(
            "Payment method is required",
            400
          );
        }
        if (paid > amount && customer_id && isbyCustomer) {
          await this.createAdvance(
            {
              customer_id,
              branch_id,
              amount: Number(paid) - Number(amount),
              payment_method_id,
              company_id
            },
            client
          );

          const updatedRemarks =
            this.appendRemark(
              lost_stock.remarks,
              "advance_received",
              {
                amount: Number(paid) - Number(amount)
              }
            );
          await executeInTransaction(
            client,
            `
          UPDATE loss_stocks
          SET remarks = $1
          WHERE id = $2
          `,
            [
              JSON.stringify(
                updatedRemarks
              ),
              lost_stock.id
            ]
          );
        }
        if (paid <= amount) {
          await this.createRentPayment(
            {
              branch_id,
              amount,
              payment_method_id,
              row_type: "loss",
              row_id: lost_stock.id,
              cash_flow: "in",
              note: null,
              remarks: [
                {
                  action: "lost payment created",
                  at: new Date().toISOString()
                }
              ]
            },
            client
          );
        }

      }
    }

    return {
      message:
        "lost stock created successfully",
      data: {
        lost_stock_id: lost_stock.id,
      }
    };
  }
  async payLostBill(
    params: PayLostBillBody,
    client: PoolClient
  ) {
    const {
      lost_row_id,
      paid,
      payment_method_id,
      note,
      company_id,
      advance_deductions = [],
      branch_id
    } = params;

    const lost_row = await executeInTransaction(
      client,
      `
    SELECT *
    FROM loss_stocks
    WHERE id = $1
    AND branch_id = $2
    AND status != $3
    `,
      [
        lost_row_id,
        branch_id,
        getStatusCode("Deleted")
      ]
    );

    const lostRow = lost_row.rows[0];

    if (!lostRow) {
      throw new AppError(
        "Lost stock not found",
        404
      );
    }

    if (
      lostRow.paid ===
      Number(lostRow.amount)
    ) {
      throw new AppError(
        "This is already fully paid",
        400
      );
    }

    if (
      paid > 0 &&
      !payment_method_id
    ) {
      throw new AppError(
        "Payment method required",
        400
      );
    }

    // ==========================
    // Apply Advance Ledgers
    // ==========================

    let advanceUsed = 0;

    for (const advance of advance_deductions) {
      const ledger =
        await this.validateAdvanceBalance(
          advance.ledger_id,
          advance.amount,
          branch_id,
          client
        );

      if (
        ledger.customer_id !==
        lostRow.responsible_by
      ) {
        throw new AppError(
          "Advance belongs to another customer",
          400
        );
      }

      advanceUsed += Number(
        advance.amount
      );

      const ledgerRemarks =
        this.appendRemark(
          ledger.remarks,
          "advance_used",
          {
            lost_row_id,
            amount: advance.amount
          }
        );


      await executeInTransaction(
        client,
        `
      UPDATE rent_customer_ledger
      SET
        remaining_amount =
          remaining_amount - $1,
        remarks = $2
      WHERE id = $3
      `,
        [
          advance.amount,
          JSON.stringify(
            ledgerRemarks
          ),
          advance.ledger_id
        ]
      );

      await executeInTransaction(
        client,
        `
      INSERT INTO rent_payments (
        branch_id,
        amount,
        payment_method_id,
        row_type,
        row_id,
        cash_flow,
        note,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
        [
          branch_id,
          advance.amount,
          ledger.payment_method_id,
          "loss",
          lost_row_id,
          "in",
          "Advance Applied",
          getStatusCode("Paid")
        ]
      );
    }

    // ==========================
    // Bill Balance
    // ==========================
    const balance =
      Number(lostRow.amount) - //1000
      Number(lostRow.paid);//600

    let remainingBalance =
      balance - advanceUsed; //400- 500 = *100

    if (remainingBalance < 0) {
      remainingBalance = 0; //true
    }

    // ==========================
    // Cash Payment
    // ==========================

    let billPayment = 0;
    let extraAdvance = 0;

    if (paid > 0) {
      billPayment = Math.min(
        paid, // 600
        remainingBalance  // 0
      );

      extraAdvance =
        paid - billPayment;  // 600-0
    }

    // ==========================
    // Update Bill Paid
    // ==========================

    const totalBillPayment =
      advanceUsed + billPayment; //500 +0 =500

    if (totalBillPayment > 0) {
      await executeInTransaction(
        client,
        `
      UPDATE loss_stocks
      SET
        paid =
          paid + $1
      WHERE id = $2
      `,
        [
          totalBillPayment, //600 + 500 =1100
          lost_row_id
        ]
      );
    }

    // ==========================
    // Bill Payment Entry
    // ==========================

    if (billPayment > 0) {
      await executeInTransaction(
        client,
        `
      INSERT INTO rent_payments (
        branch_id,
        amount,
        payment_method_id,
        row_type,
        row_id,
        cash_flow,
        note,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
        [
          branch_id,
          billPayment,
          payment_method_id,
          "loss",
          lost_row_id,
          "in",
          note || null,
          getStatusCode("Paid")
        ]
      );
    }

    // ==========================
    // Extra Amount -> Advance
    // ==========================

    if (extraAdvance > 0) {
      await this.createAdvance(
        {
          customer_id:
            lostRow.responsible_by,
          branch_id,
          amount: extraAdvance,
          payment_method_id,
          note:
            "Auto created from lost bill overpayment",
          company_id,
        },
        client
      );
    }

    // ==========================
    // Refresh Bill
    // ==========================

    const updatedlost_row =
      await executeInTransaction(
        client,
        `
      SELECT *
      FROM loss_stocks
      WHERE id = $1 
      AND branch_id =$2
      AND status !=$0
      `,
        [lost_row_id, branch_id]
      );

    const updatedBill =
      updatedlost_row.rows[0];

    const payment_status =
      this.generatePaymentStatus(updatedBill.amount, updatedBill.paid);

    await executeInTransaction(
      client,
      `
    UPDATE loss_stocks
    SET
      payment_status = $1,
    WHERE id = $2
    AND branch_id =$3
    `,
      [
        payment_status,
        lost_row_id,
        branch_id
      ]
    );

    return {
      message:
        "Payment processed successfully"
    };
  }
  async fetchLossRent(params: FetchLossRentParams) {
    const {
      branch_id,

      page = 1,
      limit = 10,
      product_id,
      search,
      status,
      customer_id,
      by_branch
    } = params;

    const offset = (page - 1) * limit;

    const conditions: string[] = [
      "ls.branch_id = $1",
      "ls.status != 0"
    ];

    const values: any[] = [branch_id];

    let paramIndex = 2;

    if (search) {
      conditions.push(`
      (
        c.customer_name ILIKE $${paramIndex}
        OR c.phone_number ILIKE $${paramIndex}
      )
    `);

      values.push(`%${search}%`);
      paramIndex++;
    }

    if (status !== undefined) {
      conditions.push(
        `ls.status = $${paramIndex}`
      );

      values.push(getStatusCode(status));
      paramIndex++;
    }

    if (product_id) {
      conditions.push(
        `ls.product_id = $${paramIndex}`
      );

      values.push(product_id);
      paramIndex++;
    }
    if (customer_id) {
      conditions.push(
        `ls.customer_id = $${paramIndex} AND ls.responsible_type = 'customer'`
      );

      values.push(customer_id);
      paramIndex++;
    }
    if (by_branch) {
      conditions.push(
        `ls.responsible_type = 'branch'`
      );
    }


    const whereClause =
      conditions.join(" AND ");

    const countQuery =
      await pool.query(
        `
      SELECT COUNT(*)::INT AS total
      FROM loss_stocks ls
     LEFT JOIN customers c
    ON c.id = ls.customer_id
     LEFT JOIN rental_stocks rs
    ON rs.id = ls.rent_stock_id
    LEFT JOIN products p
  ON p.id = ls.product_id
      WHERE ${whereClause}
      `,
        values
      );

    const total =
      countQuery.rows[0].total;

    values.push(limit);
    values.push(offset);

    const result =
      await pool.query(
        `
     SELECT
    ls.*,

    c.id AS customer_id,
    c.customer_name,
    c.phone_number,
    rs.unique_name,

    p.name AS product_name

FROM loss_stocks ls

LEFT JOIN customers c
    ON c.id = ls.customer_id

LEFT JOIN products p
    ON p.id = ls.product_id

 LEFT JOIN rental_stocks rs
  ON rs.id = ls.rent_stock_id   

WHERE ${whereClause}

ORDER BY ls.id DESC

LIMIT $${paramIndex}
OFFSET $${paramIndex + 1}
      `,
        values
      );

    return {
      data: result.rows,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(
          total / limit
        )
      }
    };
  }
  async deleteLossRent(
    data: DeleteLossRentBody,
    client: PoolClient
  ) {
    const { branch_id, deleted_by, id } = data
    const loss_stock_id = id
    const lossStockResult = await executeInTransaction(
      client,
      `
    SELECT *
    FROM loss_stocks
    WHERE id = $1
    AND status != $2
    AND branch_id = $3
    `,
      [
        loss_stock_id,
        getStatusCode("Deleted"),
        branch_id
      ]
    );

    const lossStock = lossStockResult.rows[0];

    if (!lossStock) {
      throw new AppError(
        "Lost Stock not found",
        404
      );
    }



    const lossStockRemarks =
      this.appendRemark(
        lossStock.remarks,
        "deleted",
        {
          deleted_by
        }
      );

    await executeInTransaction(
      client,
      `
    UPDATE rental_stocks
    SET
      available_units = available_units + $1,
      remarks = $2
    WHERE id = $3
    `,
      [
        Number(lossStock.quantity),
        JSON.stringify(lossStockRemarks),
        lossStock.rent_stock_id
      ]
    );
    await executeInTransaction(
      client,
      `
    UPDATE loss_stocks
    SET
      status = $1,
      remarks = $2
    WHERE id = $3
    `,
      [
        getStatusCode("Deleted"),
        JSON.stringify(lossStockRemarks),
        loss_stock_id
      ]
    );

    if (typeof lossStock.customer_id === "string") {
      await executeInTransaction(
        client,
        `
    UPDATE rent_payments
    SET
      status = $1
    WHERE
      row_type = 'loss'
      AND row_id = $2
      AND branch_id = $3
      AND status != $1
    `,
        [
          getStatusCode("Deleted"),
          loss_stock_id,
          branch_id
        ]
      );

    }
    return {
      message:
        "Rent bill deleted successfully"
    };
  }








}