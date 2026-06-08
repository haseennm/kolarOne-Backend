import { PoolClient } from "pg";
import { CreateAdvanceParams, CreateRentItem, CreateRentParams, CreateRentPaymentParams, FetchAdvanceLedgerParams, FetchRentParams, PayBillParams, ReturnAdvanceParams, ReturnRentParams } from "./rent.types";
import { executeInTransaction, pool } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { getRecord, getStatusCode } from "../../utils/extra";

export class RentService {
  private async generateBillNumber(
    branch_id: number,
    client: PoolClient
  ): Promise<string> {
    const year = new Date().getFullYear();

    const prefix = `RENT-${branch_id}${year}-`;

    const lastBill = await executeInTransaction(
      client,
      `
      SELECT bill_number
      FROM rent_bills
      WHERE branch_id = $1
      AND bill_number LIKE $2
      ORDER BY id DESC
      LIMIT 1
    `,
      [branch_id, `${prefix}%`]
    );

    let nextNumber = 1;

    if (lastBill.rows.length > 0) {
      const billNumber = lastBill.rows[0].bill_number;

      const currentSequence = parseInt(
        billNumber.split("-")[2],
        10
      );

      nextNumber = currentSequence + 1;
    }

    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
  }
  private async validateStockAvailability(
    items: CreateRentItem[],
    branch_id: number,
    client: PoolClient
  ): Promise<void> {
    const stockIds = items.map(item => item.rent_stock_id);

    const duplicateIds = stockIds.filter(
      (id, index) => stockIds.indexOf(id) !== index
    );

    if (duplicateIds.length > 0) {
      throw new AppError(
        "Duplicate rental stock found in items", 400
      );
    }

    for (const item of items) {
      if (item.quantity_taken <= 0) {
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
          item.rent_stock_id,
          branch_id,
          getStatusCode("Deleted")
        ]
      );

      const stock = stockResult.rows[0];

      if (!stock) {
        throw new AppError(
          `Rental stock ${item.rent_stock_id} not found`, 404
        );
      }

      if (
        stock.available_units <
        item.quantity_taken
      ) {
        throw new AppError(
          `${stock.unique_name} has only ${stock.available_units} units available`, 400
        );
      }
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
  //     private appendBillRemark(
  //   remarks: any[] | null,
  //   action: string,
  //   data: Record<string, any> = {}
  // ) {
  //   const existingRemarks = Array.isArray(remarks)
  //     ? remarks
  //     : [];

  //   existingRemarks.push({
  //     action,
  //     at: new Date().toISOString(),
  //     ...data
  //   });

  //   return existingRemarks;
  // }
  //    private appendBillItemRemark(
  //   remarks: any[] | null,
  //   action: string,
  //   data: Record<string, any> = {}
  // ) {
  //   const existingRemarks = Array.isArray(remarks)
  //     ? remarks
  //     : [];

  //   existingRemarks.push({
  //     action,
  //     at: new Date().toISOString(),
  //     ...data
  //   });

  //   return existingRemarks;
  // }
  //     private appendLedgerRemark(
  //   remarks: any[] | null,
  //   action: string,
  //   data: Record<string, any> = {}
  // ) {
  //   const existingRemarks = Array.isArray(remarks)
  //     ? remarks
  //     : [];

  //   existingRemarks.push({
  //     action,
  //     at: new Date().toISOString(),
  //     ...data
  //   });

  //   return existingRemarks;
  // }
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
  private async checkAllItemsReturned(
    bill_id: number,
    client: PoolClient
  ): Promise<boolean> {
    const result = await executeInTransaction(
      client,
      `
    SELECT COUNT(*)::INT AS pending_count
    FROM rent_bill_items
    WHERE bill_id = $1
    AND status != $2
    AND returned_qty < quantity_taken
    `,
      [
        bill_id,
        getStatusCode("Deleted")
      ]
    );

    return result.rows[0].pending_count === 0;
  }
  private getRentBillStatus(
    allReturned: boolean,
    totalPaid: number,
    totalAmount: number
  ): number {
    if (
      allReturned &&
      Number(totalPaid) >= Number(totalAmount)
    ) {
      return getStatusCode("Completed");
    }

    return getStatusCode("Active");
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
      `${prefix}-${branch_id}-${year}-${String(seq).padStart(4, "0")}`;

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
  private async processPayment(
    bill_id: number,
    amount: number,
    payment_method_id: number,
    branch_id: number,
    client: PoolClient,
    note?: string
  ): Promise<void> {
    if (amount <= 0) {
      throw new AppError(
        "Amount must be greater than zero",
        400
      );
    }

    const billResult = await executeInTransaction(
      client,
      `
    SELECT *
    FROM rent_bills
    WHERE id = $1
    AND branch_id = $2
    AND status != $3
    `,
      [
        bill_id,
        branch_id,
        getStatusCode("Deleted")
      ]
    );

    const bill = billResult.rows[0];

    if (!bill) {
      throw new AppError(
        "Rent bill not found",
        404
      );
    }

    const balance =
      Number(bill.total_amount) -
      Number(bill.total_paid);

    const billAmount = Math.min(
      amount,
      Math.max(balance, 0)
    );

    const advanceAmount =
      amount - billAmount;

    // bill payment
    if (billAmount > 0) {
      await this.createRentPayment(
        {
          branch_id,
          amount,
          payment_method_id,
          row_type: "loss",
          row_id: bill_id,
          cash_flow: "in",
          note: null,
          remarks: [
            {
              action: "bill_payment",
              amount: billAmount,
              at: new Date().toISOString()
            }
          ]
        },
        client
      );
      const updatedRemarks = this.appendRemark(
        bill.remarks,
        "payment",
        {
          amount: billAmount
        }
      );

      await executeInTransaction(
        client,
        `
      UPDATE rent_bills
      SET
        total_paid = total_paid + $1,
        remarks = $2
      WHERE id = $3
      `,
        [
          billAmount,
          JSON.stringify(updatedRemarks),
          bill_id
        ]
      );
    }

    // excess => advance
    if (advanceAmount > 0) {
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
      RETURNING id
      `,
        [
          bill.customer_id,
          branch_id,
          advanceAmount,
          advanceAmount,
          payment_method_id,
          JSON.stringify([
            {
              action: "advance_created",
              amount: advanceAmount,
              at: new Date().toISOString()
            }
          ]),
          getStatusCode("Active")
        ]
      );

      const ledgerId =
        ledgerResult.rows[0].id;

      await this.createRentPayment(
        {
          branch_id,
          amount,
          payment_method_id,
          row_type: "loss",
          row_id: ledgerId,
          cash_flow: "in",
          note: null,
          remarks: [
            {
              action: "advance_payment",
              amount: advanceAmount,
              at: new Date().toISOString()
            }
          ]
        },
        client
      );
    }

    const refreshedBill = await executeInTransaction(
      client,
      `
    SELECT
      total_amount,
      total_paid
    FROM rent_bills
    WHERE id = $1
    `,
      [bill_id]
    );

    const allReturned =
      await this.checkAllItemsReturned(
        bill_id,
        client
      );

    const status =
      this.getRentBillStatus(
        allReturned,
        Number(
          refreshedBill.rows[0].total_paid
        ),
        Number(
          refreshedBill.rows[0].total_amount
        )
      );

    await executeInTransaction(
      client,
      `
  UPDATE rent_bills
  SET
    status = $1::int,
    actual_close_date = CASE
      WHEN $1::int = $2::int
      THEN NOW()
      ELSE actual_close_date
    END
  WHERE id = $3::int
  `,
      [
        status,
        getStatusCode("Completed"),
        bill_id
      ]
    );
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

    await this.createRentPayment(
      {
        branch_id,
        amount,
        payment_method_id,
        row_type: "loss",
        row_id: ledger.id,
        cash_flow: "in",
        note: null,
        remarks: [
          {
            action: "advance_payment",
            amount,
            at: new Date().toISOString()
          }
        ]
      },
      client
    );

    return ledger;
  }

  async returnAdvance(
    params: ReturnAdvanceParams,
    client: PoolClient
  ) {
    const {
      ledger_id,
      amount,
      payment_method_id,
      note,
      company_id,
      branch_id
    } = params;

    if (amount <= 0) {
      throw new AppError(
        "Amount must be greater than zero",
        400
      );
    }

    const ledger = await this.validateAdvanceBalance(
      ledger_id,
      amount,
      branch_id, // remove branch validation if validateAdvanceBalance doesn't need it
      client
    );

    const customer = await getRecord(
      ledger.customer_id,
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
      throw new AppError("Payment method not found", 404);
    }

    const updatedRemarks = this.appendRemark(
      ledger.remarks,
      "advance_refund",
      {
        amount,
        payment_method_id,
        note
      }
    );

    const ledgerResult = await executeInTransaction(
      client,
      `
    UPDATE rent_customer_ledger
    SET
      remaining_amount = remaining_amount - $1,
      remarks = $2
    WHERE id = $3
    RETURNING *
    `,
      [
        amount,
        JSON.stringify(updatedRemarks),
        ledger_id
      ]
    );

    await this.createRentPayment(
      {
        branch_id,
        amount,
        payment_method_id,
        row_type: "loss",
        row_id: ledger_id,
        cash_flow: "in",
        note: null,
        remarks: [
          {
            action: "advance_refund",
            amount,
            at: new Date().toISOString()
          }
        ]
      },
      client
    );

    return {
      message: "Advance refunded successfully",
      data: ledgerResult.rows[0]
    };
  }

  async createRent(
    params: CreateRentParams,
    client: PoolClient
  ) {
    const {
      customer_id,
      branch_id,
      expected_return_date,
      items,
      payment_method_id,
      amount_received,
      company_id
    } = params;

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

    if (
      customer.status ===
      getStatusCode("Blacklist")
    ) {
      throw new AppError(
        "Customer is blacklisted",
        400
      );
    }

    if (!items.length) {
      throw new AppError(
        "At least one rental item is required",
        400
      );
    }

    await this.validateStockAvailability(
      items,
      branch_id,
      client
    );

    const billNumber =
      await this.generateBillNumber(
        branch_id,
        client
      );

    const billRemarks = [
      {
        action: "rent_created",
        at: new Date().toISOString()
      }
    ];

    const billResult =
      await executeInTransaction(
        client,
        `
      INSERT INTO rent_bills (
        customer_id,
        branch_id,
        bill_number,
        start_date,
        expected_return_date,
        total_amount,
        total_paid,
        status,
        remarks
      )
      VALUES (
        $1,$2,$3,
        NOW(),
        $4,
        0,
        0,
        $5,
        $6
      )
      RETURNING *
      `,
        [
          customer_id,
          branch_id,
          billNumber,
          expected_return_date || null,
          getStatusCode("Active"),
          JSON.stringify(billRemarks)
        ]
      );

    const bill = billResult.rows[0];

    for (const item of items) {
      const stockResult =
        await executeInTransaction(
          client,
          `
        SELECT *
        FROM rental_stocks
        WHERE id = $1
        `,
          [item.rent_stock_id]
        );

      const stock = stockResult.rows[0];

      const rate =
        item.rate_per_item ??
        stock.hourly_rate ?? 0;

      await executeInTransaction(
        client,
        `
      INSERT INTO rent_bill_items (
        bill_id,
        product_id,
        rent_stock_id,
        quantity_taken,
        returned_qty,
        rate_per_item,
        status,
        remarks
      )
      VALUES (
        $1,$2,$3,
        $4,
        0,
        $5,
        $6,
        $7
      )
      `,
        [
          bill.id,
          stock.product_id,
          stock.id,
          item.quantity_taken,
          rate,
          getStatusCode("Active"),
          JSON.stringify([
            {
              action: "item_added",
              quantity: item.quantity_taken,
              rate_per_item: rate,
              at: new Date().toISOString()
            }
          ])
        ]
      );

      await executeInTransaction(
        client,
        `
      UPDATE rental_stocks
      SET
        available_units =
          available_units - $1
      WHERE id = $2
      `,
        [
          item.quantity_taken,
          stock.id
        ]
      );
    }

    // Initial advance payment
    if (
      amount_received &&
      amount_received > 0
    ) {
      if (!payment_method_id) {
        throw new AppError(
          "Payment method is required",
          400
        );
      }

      await this.createAdvance(
        {
          customer_id,
          branch_id,
          amount: amount_received,
          payment_method_id,
          company_id
        },
        client
      );

      const updatedRemarks =
        this.appendRemark(
          bill.remarks,
          "advance_received",
          {
            amount: amount_received
          }
        );

      await executeInTransaction(
        client,
        `
      UPDATE rent_bills
      SET remarks = $1
      WHERE id = $2
      `,
        [
          JSON.stringify(
            updatedRemarks
          ),
          bill.id
        ]
      );
    }

    return {
      message:
        "Rent created successfully",
      data: {
        bill_id: bill.id,
        bill_number:
          bill.bill_number
      }
    };
  }


  async payBill(
    params: PayBillParams,
    client: PoolClient
  ) {
    const {
      bill_id,
      amount = 0,
      payment_method_id,
      note,
      company_id,
      advance_deductions = [],
      branch_id
    } = params;

    const billResult = await executeInTransaction(
      client,
      `
    SELECT *
    FROM rent_bills
    WHERE id = $1
    AND branch_id = $2
    AND status != $3
    `,
      [
        bill_id,
        branch_id,
        getStatusCode("Deleted")
      ]
    );

    const bill = billResult.rows[0];

    if (!bill) {
      throw new AppError(
        "Rent bill not found",
        404
      );
    }

    const customer = await getRecord(
      bill.customer_id,
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

    if (
      bill.status ===
      getStatusCode("Completed")
    ) {
      throw new AppError(
        "Bill already completed",
        400
      );
    }

    if (
      amount > 0 &&
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
        bill.customer_id
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
            bill_id,
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

     await this.createRentPayment(
            {
              branch_id,
              amount,
              payment_method_id,
              row_type: "loss",
              row_id:bill_id,
              cash_flow: "in",
              note: null,
              remarks: [
                {
                  action: "Bill amount paid",
                  at: new Date().toISOString()
                }
              ]
            },
            client
          );
    }

    // ==========================
    // Bill Balance
    // ==========================

    const balance =
      Number(bill.total_amount) -
      Number(bill.total_paid);

    let remainingBalance =
      balance - advanceUsed;

    if (remainingBalance < 0) {
      remainingBalance = 0;
    }

    // ==========================
    // Cash Payment
    // ==========================

    let billPayment = 0;
    let extraAdvance = 0;

    if (amount > 0) {
      billPayment = Math.min(
        amount,
        remainingBalance
      );

      extraAdvance =
        amount - billPayment;
    }

    // ==========================
    // Update Bill Paid
    // ==========================

    const totalBillPayment =
      advanceUsed + billPayment;

    if (totalBillPayment > 0) {
      await executeInTransaction(
        client,
        `
      UPDATE rent_bills
      SET
        total_paid =
          total_paid + $1
      WHERE id = $2
      `,
        [
          totalBillPayment,
          bill_id
        ]
      );
    }

    // ==========================
    // Bill Payment Entry
    // ==========================

    if (billPayment > 0) {
     await this.createRentPayment(
            {
              branch_id,
              amount,
              payment_method_id,
              row_type: "loss",
              row_id: bill_id,
              cash_flow: "in",
              note: null,
              remarks: [
                {
                  at: new Date().toISOString()
                }
              ]
            },
            client
          );
    }

    // ==========================
    // Extra Amount -> Advance
    // ==========================

    if (extraAdvance > 0) {
      await this.createAdvance(
        {
          customer_id:
            bill.customer_id,
          branch_id,
          amount: extraAdvance,
          payment_method_id,
          note:
            "Auto created from bill overpayment",
          company_id,
        },
        client
      );
    }

    // ==========================
    // Refresh Bill
    // ==========================

    const updatedBillResult =
      await executeInTransaction(
        client,
        `
      SELECT *
      FROM rent_bills
      WHERE id = $1
      `,
        [bill_id]
      );

    const updatedBill =
      updatedBillResult.rows[0];

    const allReturned =
      await this.checkAllItemsReturned(
        bill_id,
        client
      );

    const status =
      this.getRentBillStatus(
        allReturned,
        Number(
          updatedBill.total_paid
        ),
        Number(
          updatedBill.total_amount
        )
      );

    await executeInTransaction(
      client,
      `
    UPDATE rent_bills
    SET
      status = $1,
      actual_close_date =
        CASE
          WHEN $1 = $2
          THEN NOW()
          ELSE actual_close_date
        END
    WHERE id = $3
    `,
      [
        status,
        getStatusCode("Completed"),
        bill_id
      ]
    );

    return {
      message:
        "Payment processed successfully"
    };
  }

  async returnRent(
    params: ReturnRentParams,
    client: PoolClient
  ) {
    const {
      bill_id,
      items,
      company_id,
      advance_deductions = [],
      payment_amount = 0,
      payment_method_id,
      branch_id
    } = params;

    const billResult = await executeInTransaction(
      client,
      `
    SELECT *
    FROM rent_bills
    WHERE id = $1
    AND branch_id = $2
    AND status != $3
    `,
      [
        bill_id,
        branch_id,
        getStatusCode("Deleted")
      ]
    );

    const bill = billResult.rows[0];

    if (!bill) {
      throw new AppError(
        "Rent bill not found",
        404
      );
    }

    let generatedAmount = 0;

    // =====================================
    // Return Items
    // =====================================

    for (const item of items) {
      if (item.return_qty <= 0) {
        throw new AppError(
          "Return quantity must be greater than zero",
          400
        );
      }

      const billItemResult =
        await executeInTransaction(
          client,
          `
        SELECT *
        FROM rent_bill_items
        WHERE id = $1
        AND bill_id = $2
        AND status != $3
        `,
          [
            item.bill_item_id,
            bill_id,
            getStatusCode("Deleted")
          ]
        );

      const billItem =
        billItemResult.rows[0];

      if (!billItem) {
        throw new AppError(
          "Bill item not found",
          404
        );
      }

      const remainingQty =
        Number(
          billItem.quantity_taken
        ) -
        Number(
          billItem.returned_qty
        );

      if (
        item.return_qty >
        remainingQty
      ) {
        throw new AppError(
          `Only ${remainingQty} quantity pending for return`,
          400
        );
      }

      generatedAmount += Number(
        item.amount
      );

      const itemRemarks =
        this.appendRemark(
          billItem.remarks,
          "returned",
          {
            qty: item.return_qty,
            amount: item.amount
          }
        );

      await executeInTransaction(
        client,
        `
      UPDATE rent_bill_items
      SET
        returned_qty =
          returned_qty + $1,
        remarks = $2,
        amount = $3
      WHERE id = $4
      `,
        [
          item.return_qty,
          JSON.stringify(
            itemRemarks
          ),
          item.amount,
          item.bill_item_id
        ]
      );

      await executeInTransaction(
        client,
        `
      UPDATE rental_stocks
      SET
        available_units =
          available_units + $1
      WHERE id = $2 
      AND product_id =$3
      `,
        [
          item.return_qty,
          billItem.rent_stock_id,
          billItem.product_id
        ]
      );
    }

    // =====================================
    // Update Bill Amount
    // =====================================

    const billRemarks =
      this.appendRemark(
        bill.remarks,
        "return_processed",
        {
          amount: generatedAmount
        }
      );

    await executeInTransaction(
      client,
      `
    UPDATE rent_bills
    SET
      total_amount =
        total_amount + $1,
      remarks = $2
    WHERE id = $3
    AND branch_id =$4
    `,
      [
        generatedAmount,
        JSON.stringify(
          billRemarks
        ),
        bill_id,
        branch_id
      ]
    );

    // =====================================
    // Use Advance
    // =====================================

    for (const advance of advance_deductions) {
      const ledger =
        await this.validateAdvanceBalance(
          advance.ledger_id,
          advance.amount,
          bill.branch_id,
          client
        );

      const ledgerRemarks =
        this.appendRemark(
          ledger.remarks,
          "advance_used",
          {
            bill_id,
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
      UPDATE rent_bills
      SET
        total_paid =
          total_paid + $1
      WHERE id = $2
      `,
        [
          advance.amount,
          bill_id
        ]
      );
    }

    // =====================================
    // Direct Payment
    // =====================================

    if (payment_amount > 0) {
      if (!payment_method_id) {
        throw new AppError(
          "Payment method is required",
          400
        );
      }
      const isPaymentMethodExist = await getRecord(
        payment_method_id,
        "payment_methods",
        "company_id",
        company_id,
        client
      );
      if (!isPaymentMethodExist) {
        throw new AppError(
          "Payment method not found",
          400
        );
      }

      await this.processPayment(
        bill_id,
        payment_amount,
        payment_method_id,
        bill.branch_id,
        client,
        "Rent return payment"
      );
    }

    // =====================================
    // Refresh Bill
    // =====================================

    const refreshedBill =
      await executeInTransaction(
        client,
        `
      SELECT *
      FROM rent_bills
      WHERE id = $1
      `,
        [bill_id]
      );

    const updatedBill =
      refreshedBill.rows[0];

    const allReturned =
      await this.checkAllItemsReturned(
        bill_id,
        client
      );

    const status =
      this.getRentBillStatus(
        allReturned,
        Number(
          updatedBill.total_paid
        ),
        Number(
          updatedBill.total_amount
        )
      );

    await executeInTransaction(
      client,
      `
  UPDATE rent_bills
  SET
    status = $1::int,
    actual_close_date = CASE
      WHEN $1::int = $2::int
      THEN NOW()
      ELSE actual_close_date
    END
  WHERE id = $3::int
  `,
      [
        status,
        getStatusCode("Completed"),
        bill_id
      ]
    );

    return {
      message:
        "Rent returned successfully"
    };
  }
  async fetchRent(params: FetchRentParams) {
    const {
      branch_id,

      page = 1,
      limit = 10,

      search,
      status,
      customer_id,

      from_date,
      to_date
    } = params;

    const offset = (page - 1) * limit;

    const conditions: string[] = [
      "rb.branch_id = $1",
      "rb.status != 0"
    ];

    const values: any[] = [branch_id];

    let paramIndex = 2;

    if (search) {
      conditions.push(`
      (
        rb.bill_number ILIKE $${paramIndex}
        OR c.customer_name ILIKE $${paramIndex}
        OR c.phone_number ILIKE $${paramIndex}
      )
    `);

      values.push(`%${search}%`);
      paramIndex++;
    }

    if (status !== undefined) {
      conditions.push(
        `rb.status = $${paramIndex}`
      );

      values.push(status);
      paramIndex++;
    }

    if (customer_id) {
      conditions.push(
        `rb.customer_id = $${paramIndex}`
      );

      values.push(customer_id);
      paramIndex++;
    }

    if (from_date) {
      conditions.push(
        `DATE(rb.start_date) >= $${paramIndex}`
      );

      values.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      conditions.push(
        `DATE(rb.start_date) <= $${paramIndex}`
      );

      values.push(to_date);
      paramIndex++;
    }

    const whereClause =
      conditions.join(" AND ");

    const countQuery =
      await pool.query(
        `
      SELECT COUNT(*)::INT AS total
      FROM rent_bills rb
      INNER JOIN customers c
        ON c.id = rb.customer_id
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
        rb.id,
        rb.bill_number,

        rb.start_date,
        rb.expected_return_date,
        rb.actual_close_date,

        rb.total_amount,
        rb.total_paid,

        rb.status,

        c.id AS customer_id,
        c.customer_name,
        c.phone_number

      FROM rent_bills rb

      INNER JOIN customers c
        ON c.id = rb.customer_id

      WHERE ${whereClause}

      ORDER BY rb.id DESC

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

  async getRentById(
    bill_id: number,
    branch_id: number
  ) {
    const billResult =
      await pool.query(
        `
      SELECT
        rb.*,

        c.customer_name,
        c.phone_number,
        c.customer_type

      FROM rent_bills rb

      INNER JOIN customers c
        ON c.id = rb.customer_id

      WHERE rb.id = $1
      AND rb.branch_id = $2
      AND rb.status != $3
      `,
        [
          bill_id,
          branch_id,
          getStatusCode("Deleted")
        ]
      );

    const bill =
      billResult.rows[0];

    if (!bill) {
      throw new AppError(
        "Rent bill not found",
        404
      );
    }



    const items =
      await pool.query(
        `
      SELECT
        rbi.*,

        p.name AS product_name,

        rs.unique_name

      FROM rent_bill_items rbi

      INNER JOIN products p
        ON p.id = rbi.product_id

      INNER JOIN rental_stocks rs
        ON rs.id = rbi.rent_stock_id

      WHERE rbi.bill_id = $1
      AND rbi.status != $2

      ORDER BY rbi.id
      `,
        [
          bill_id,
          getStatusCode("Deleted")
        ]
      );

    const payments =
      await pool.query(
        `
      SELECT *
      FROM rent_payments
      WHERE
        (
          row_type = 'bill'
          AND row_id = $1
        )
      ORDER BY id DESC
      `,
        [bill_id]
      );

    return {
      bill,
      items: items.rows,
      payments: payments.rows,

      balance_due:
        Number(bill.total_amount) -
        Number(bill.total_paid)
    };
  }

  async fetchAdvanceLedger(
    params: FetchAdvanceLedgerParams
  ) {
    const {
      branch_id,

      page = 1,
      limit = 10,

      customer_id,
      search
    } = params;

    const offset =
      (page - 1) * limit;

    const conditions = [
      "rcl.branch_id = $1",
      "rcl.status != 0"
    ];

    const values: any[] = [
      branch_id
    ];

    let paramIndex = 2;

    if (customer_id) {
      conditions.push(
        `rcl.customer_id = $${paramIndex}`
      );

      values.push(customer_id);

      paramIndex++;
    }

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

    const whereClause =
      conditions.join(" AND ");

    const countResult =
      await pool.query(
        `
      SELECT COUNT(*)::INT total
      FROM rent_customer_ledger rcl
      INNER JOIN customers c
        ON c.id = rcl.customer_id
      WHERE ${whereClause}
      `,
        values
      );

    const total =
      countResult.rows[0].total;

    values.push(limit);
    values.push(offset);

    const result =
      await pool.query(
        `
      SELECT
        rcl.*,

        c.customer_name,
        c.phone_number,
        pm.method_name,

        (
          rcl.amount -
          rcl.remaining_amount
        ) AS used_amount

      FROM rent_customer_ledger rcl

      INNER JOIN customers c
      ON c.id = rcl.customer_id
      INNER JOIN payment_methods pm
        ON pm.id = rcl.payment_method_id

      WHERE ${whereClause}

      ORDER BY rcl.id DESC

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

  async getAdvanceLedgerById(
    ledger_id: number,
    branch_id: number
  ) {
    const ledgerResult =
      await pool.query(
        `
      SELECT
        rcl.*,

        c.customer_name,
        c.phone_number

      FROM rent_customer_ledger rcl

      INNER JOIN customers c
        ON c.id = rcl.customer_id

      WHERE rcl.id = $1
      AND rcl.status != $2
      AND rcl.branch_id = $3
      `,
        [
          ledger_id,
          getStatusCode("Deleted"),
          branch_id
        ]
      );

    const ledger =
      ledgerResult.rows[0];

    if (!ledger) {
      throw new AppError(
        "Advance ledger not found",
        404
      );
    }

    const transactions =
      await pool.query(
        `
      SELECT *
      FROM rent_payments
      WHERE
        row_type = 'advance'
        AND row_id = $1
        AND status != $2
      ORDER BY id DESC
      `,
        [
          ledger_id,
          getStatusCode("Deleted")
        ]
      );

    return {
      ledger,
      transactions:
        transactions.rows
    };
  }

  async deleteRent(
    bill_id: number,
    branch_id: number,
    client: PoolClient
  ) {
    const billResult = await executeInTransaction(
      client,
      `
    SELECT *
    FROM rent_bills
    WHERE id = $1
    AND status != $2
    AND branch_id = $3
    `,
      [
        bill_id,
        getStatusCode("Deleted"),
        branch_id
      ]
    );

    const bill = billResult.rows[0];

    if (!bill) {
      throw new AppError(
        "Rent bill not found",
        404
      );
    }

    const billItemsResult =
      await executeInTransaction(
        client,
        `
      SELECT *
      FROM rent_bill_items
      WHERE bill_id = $1
      AND status != $2
      `,
        [
          bill_id,
          getStatusCode("Deleted")
        ]
      );

    const billItems =
      billItemsResult.rows;

    // Restore all quantities back to stock
    for (const item of billItems) {
      const outstandingQty =
        Number(item.quantity_taken) -
        Number(item.returned_qty);

      if (outstandingQty > 0) {
        await executeInTransaction(
          client,
          `
        UPDATE rental_stocks
        SET
          available_units =
            available_units + $1
        WHERE id = $2
        `,
          [
            outstandingQty,
            item.rent_stock_id
          ]
        );
      }

      const itemRemarks =
        this.appendRemark(
          item.remarks,
          "deleted",
          {
            bill_id
          }
        );

      await executeInTransaction(
        client,
        `
      UPDATE rent_bill_items
      SET
        status = $1,
        remarks = $2
      WHERE id = $3
      `,
        [
          getStatusCode("Deleted"),
          JSON.stringify(itemRemarks),
          item.id
        ]
      );
    }

    const billRemarks =
      this.appendRemark(
        bill.remarks,
        "deleted",
        {
          bill_number:
            bill.bill_number
        }
      );

    await executeInTransaction(
      client,
      `
    UPDATE rent_bills
    SET
      status = $1,
      remarks = $2
    WHERE id = $3
    `,
      [
        getStatusCode("Deleted"),
        JSON.stringify(billRemarks),
        bill_id
      ]
    );

    // Soft delete bill payments only
    await executeInTransaction(
      client,
      `
    UPDATE rent_payments
    SET
      status = $1
    WHERE
      row_type = 'bill'
      AND row_id = $2
      AND status != $1
    `,
      [
        getStatusCode("Deleted"),
        bill_id
      ]
    );

    return {
      message:
        "Rent bill deleted successfully"
    };
  }








}