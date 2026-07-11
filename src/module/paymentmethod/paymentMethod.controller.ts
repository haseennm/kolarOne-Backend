import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import { emitAuditJournal } from "../journal/journal.utils";
import PaymentMethodService from "./paymentMethod.service";
import {
  CreatePaymentMethodBody,
  DeletePaymentMethodBody,
  EditPaymentMethodBody
} from "./paymentMethod.types";

export default class PaymentMethodController {

  service = new PaymentMethodService();

  async createPaymentMethod(data: CreatePaymentMethodBody) {

    return transaction(async (client) => {
      const { created_by, status, ...rest } = data;

      const statusCode = getStatusCode(status);

      const paymentMethod = await this.service.createPaymentMethod({
        ...rest,
        created_by,
        statusCode
      }, client);

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "payment_methods",
        tableRowId: paymentMethod.id,
        action: "create",
        record: paymentMethod,
      });

      return paymentMethod;
    });
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

    return transaction(async (client) => {
      const { updated_by, status, ...rest } = data;

      let statusCode = 99;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const result = await this.service.updatePaymentMethod({
        ...rest,
        updated_by,
        statusCode
      }, client);

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "payment_methods",
        tableRowId: result.data.id,
        action: "update",
        record: result.data,
        changes: result.changes,
      });

      return result;
    });
  }

  async deletePaymentMethod(data: DeletePaymentMethodBody) {

    return transaction(async (client) => {
      const { deleted_by, ...rest } = data;

      const paymentMethod = await this.service.deletePaymentMethod({
        ...rest,
        deleted_by
      }, client);

      await emitAuditJournal({
        client,
        entityId: data.company_id,
        entityType: "C",
        companyId: data.company_id,
        tableName: "payment_methods",
        tableRowId: paymentMethod.id,
        action: "delete",
        record: paymentMethod,
      });

      return paymentMethod;
    });
  }

}