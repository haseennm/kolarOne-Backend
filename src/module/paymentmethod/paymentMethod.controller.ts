import { getStatusCode, getStatusText } from "../../utils/extra";
import PaymentMethodService from "./paymentMethod.service";
import {
  CreatePaymentMethodBody,
  DeletePaymentMethodBody,
  EditPaymentMethodBody
} from "./paymentMethod.types";

export default class PaymentMethodController {

  service = new PaymentMethodService();

  async createPaymentMethod(data: CreatePaymentMethodBody) {

    const { created_by, status, ...rest } = data;

    const statusCode = getStatusCode(status);

    const paymentMethod = await this.service.createPaymentMethod({
      ...rest,
      created_by,
      statusCode
    });

    return paymentMethod;
  }

  async fetchPaymentMethod(data: any) {

    const paymentMethod_with_code =
      await this.service.fetchPaymentMethod(data);

    const paymentMethods = paymentMethod_with_code.paymentMethods.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      paymentMethods,
      pagination: { ...paymentMethod_with_code.pagination }
    };
  }

  async editPaymentMethod(data: EditPaymentMethodBody) {

    const { updated_by, status, ...rest } = data;

    let statusCode = 99;

    if (typeof status === "string") {
      statusCode = getStatusCode(status);
    }

    const paymentMethod = await this.service.updatePaymentMethod({
      ...rest,
      updated_by,
      statusCode
    });

    return paymentMethod;
  }

  async deletePaymentMethod(data: DeletePaymentMethodBody) {

    const { deleted_by, ...rest } = data;

    const paymentMethod = await this.service.deletePaymentMethod({
      ...rest,
      deleted_by
    });

    return paymentMethod;
  }

}