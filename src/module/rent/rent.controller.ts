
import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { RentService } from "./rent.service";
import { CreateAdvanceBody, CreateRentParams,  FetchRentQuery, PayBillBody, ReturnAdvanceBody, ReturnRentParams} from "./rent.types";

export class RentController {
  private rentService = new RentService();

  async createRent(body: CreateRentParams) {
    return transaction(async (client) => {
      return this.rentService.createRent(body, client);
    })
  }

  async returnRent(body: ReturnRentParams) {
    return transaction(async (client) => {
      return this.rentService.returnRent(body, client);
    })
  }

  async payBill(body: PayBillBody) {
    return transaction(async (client) => {
      return this.rentService.payBill(body, client);
    })
  }

  async createAdvance(body: CreateAdvanceBody) {
    return transaction(async (client) => {
      return this.rentService.createAdvance(body, client);
    })
  }

  async returnAdvance(body: ReturnAdvanceBody) {
    return transaction(async (client) => {
      return this.rentService.returnAdvance(body, client);
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
      return this.rentService.deleteRent(
        bill_id,
        branch_id,
        client
      );
    })
  }
}