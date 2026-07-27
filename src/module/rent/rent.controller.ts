
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
import { RentService } from "./rent.service";
import { CreateAdvanceBody, CreateRentParams, FetchRentQuery, PayBillBody, ReturnAdvanceBody, ReturnBillAmountBody, ReturnRentParams, UpdateRentParams } from "./rent.types";

export class RentController {
  private rentService = new RentService();

  async createRent(body: CreateRentParams) {
    return transaction(async (client) => {
      const rent = await this.rentService.createRent(body, client);
      await emitAuditJournal({
        client,
        entityId: body.branch_id,
        entityType: "B",
        companyId: body.company_id,
        tableName: "rent_bills",
        tableRowId: rent.data.bill_id,
        action: "create",
        record: rent.data,
      });
    })
  }

  async returnRent(body: ReturnRentParams) {
    return transaction(async (client) => {
      return this.rentService.returnRent(body, client);
    })
  }

  async updateRent(body: UpdateRentParams) {
    return transaction(async (client) => {
      const rent = await this.rentService.updateRent(body, client);
      await emitAuditJournal({
        client,
        entityId: body.branch_id,
        entityType: "B",
        companyId: body.company_id,
        tableName: "rent_bills",
        tableRowId: rent.data.id,
        action: "update",
        record: rent.data,
        changes: {
          "rent": rent.changes
        },
      });
      return rent
    })
  }

  async payBill(body: PayBillBody) {
    return transaction(async (client) => {
      const bill = await this.rentService.payBill(body, client);
      await emitAuditJournal({
        client,
        entityId: body.branch_id,
        entityType: "B",
        companyId: body.company_id,
        tableName: "rent_bills",
        tableRowId: body.bill_id,
        action: "repay",
        record: bill.data
      });
      return bill.message
    })
  }

  async createAdvance(body: CreateAdvanceBody) {
    return transaction(async (client) => {
      const advance = await this.rentService.createAdvance(body, client);
      await emitAuditJournal({
        client,
        entityId: body.branch_id,
        entityType: "B",
        companyId: body.company_id,
        tableName: "rent_customer_ledger",
        tableRowId: advance.id,
        action: "create",
        record: advance,
      });
      return advance
    })
  }

  async refundBill(body: ReturnBillAmountBody) {
    return transaction(async (client) => {
      const repay = await this.rentService.refundBillAmount(body, client);
      await emitAuditJournal({
        client,
        entityId: body.branch_id,
        entityType: "B",
        companyId: body.company_id,
        tableName: "rent_customer_ledger",
        tableRowId: repay.data.id,
        action: "repay",
        record: repay.data
      });
    })
  }
  async returnAdvance(body: ReturnAdvanceBody) {
    return transaction(async (client) => {
      const result = await this.rentService.returnAdvance(body, client);
      for (const ledger of result.data) {
        await emitAuditJournal({
          client,
          entityId: body.branch_id,
          entityType: "B",
          companyId: body.company_id,
          tableName: "rent_customer_ledger",
          tableRowId: ledger.id,
          action: "repay",
          record: ledger,
          changes: ledger.changes
        });
      }
    })
  }

  async fetchRent(data: FetchRentQuery) {
    const { status, ...rest } = data;

    const statusCode = status
      ? getStatusCode(status)
      : undefined;

    const res = await this.rentService.fetchRent({
      ...rest,
      status: statusCode,
    });

    return {
      ...res,
      data: res.data.map(rent => ({
        ...rent,
        status: getStatusText(rent.status),
      })),
    };
  }

  async getRentById(id: number, branch_id: number) {
    const res = await this.rentService.getRentById(id, branch_id);

    return {
      ...res,
      bill: {
        ...res.bill,
        status: getStatusText(res.bill.status),
      },
      items: res.items.map(item => ({
        ...item,
        status: getStatusText(item.status),
      })),
    };
  }
  async fetchAdvanceLedger(
    data: FetchRentQuery
  ) {
    const res = await this.rentService.fetchAdvanceLedger(
      data
    );
    return {
      ...res,
      data: res.data.map(rent => ({
        ...rent,
        status: getStatusText(rent.status),
      })),
    };
  }

  async getAdvanceLedgerById(
    id: number,
    branch_id: number
  ) {
    return this.rentService.getAdvanceLedgerById(
      id,
      branch_id
    );
  }

  async deleteRent(
    bill_id: number,
    branch_id: number
  ) {
    return transaction(async (client) => {
      const delete_rent = await this.rentService.deleteRent(
        bill_id,
        branch_id,
        client
      );
      await emitAuditJournal({
        client,
        entityId: delete_rent.data.branch_id,
        entityType: "B",
        companyId: delete_rent.company_id.company_id,
        tableName: "rent_bills",
        tableRowId: delete_rent.data.id,
        action: "delete",
        record: delete_rent.data,
      });
    })
  }
}
