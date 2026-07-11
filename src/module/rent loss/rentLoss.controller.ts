
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
import { RentLossService } from "./rentLoss.service";
import { CreateRentLossBody, DeleteLossRentBody, FetchLossRentParams, PayLostBillBody } from "./rentLoss.types";

export class RentLossController {
  private rentLossService = new RentLossService();

  async createRent(body: CreateRentLossBody) {

    return transaction(async (client) => {
      const loss_remt_stock = await this.rentLossService.createRentLoss(body, client);
      await emitAuditJournal({
        client,
        entityId: body.branch_id,
        entityType: "B",
        companyId: body.company_id,
        tableName: "loss_stocks",
        tableRowId: loss_remt_stock.data.id,
        action: "create",
        record: loss_remt_stock.data,
      });
    })
  }
  async payLostBill(body: PayLostBillBody) {
    return transaction(async (client) => {
      const pay_bill = await this.rentLossService.payLostBill(body, client);
      await emitAuditJournal({

        client,
        entityId: body.branch_id,
        entityType: "B",
        companyId: body.company_id,
        tableName: "loss_stocks",
        tableRowId: pay_bill.data.id,
        action: "repay",
        record: pay_bill.data
      });
    })
  }
  async fetchLossRent(data: FetchLossRentParams) {

    const res = await this.rentLossService.fetchLossRent(data);
    return {
      ...res,
      data: res.data.map(rent => ({
        ...rent,
        status: getStatusText(rent.status),
        payment_status: getStatusText(rent.payment_status),
      })),
    };
  }
  async deleteLossRent(data: DeleteLossRentBody) {
    return transaction(async (client) => {
      const deleted_loss_rent = await this.rentLossService.deleteLossRent(
        data,
        client
      );
      await emitAuditJournal({
        client,
        entityId: deleted_loss_rent.data.branch_id,
        entityType: "B",
        companyId: deleted_loss_rent.data.company_id,
        tableName: "loss_stocks",
        tableRowId: deleted_loss_rent.data.id,
        action: "delete",
        record: deleted_loss_rent.data,
      });
    })
  }
}