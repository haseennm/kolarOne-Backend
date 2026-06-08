
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { RentLossService } from "./rentLoss.service";
import { CreateRentLossBody, DeleteLossRentBody, FetchLossRentParams, PayLostBillBody } from "./rentLoss.types";

export class RentLossController {
  private rentLossService = new RentLossService();

  async createRent(body: CreateRentLossBody) {

    return transaction(async (client) => {
      return this.rentLossService.createRentLoss(body, client);
    })
  }
  async payLostBill(body: PayLostBillBody) {
    return transaction(async (client) => {
      return this.rentLossService.payLostBill(body, client);
    })
  }
  async fetchLossRent(data: FetchLossRentParams) {

    const res = await this.rentLossService.fetchLossRent(data);
    console.log(res)
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
      return this.rentLossService.deleteLossRent(
        data,
        client
      );
    })
  }
}