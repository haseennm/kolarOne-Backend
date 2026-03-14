import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { convertEntityType, EntityKey, getStatusCode, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import SalaryService from "./salary.service";
import { ConfirmSalary, GenerateSalaryBody } from "./salary.types";

export default class SalaryController {
  async generateSalary(data: GenerateSalaryBody) {
    const { created_by, from_date, to_date, month_salary, ...rest } = data
    const remark = {
      date: new Date().toISOString(),
      action: "Salary auto-generated",
      action_by: created_by,
    };
    const start = new Date(from_date);
    const end = new Date(to_date);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (86400000)) + 1;

    if (diffDays > 31 || diffDays <= 0) {
      throw new AppError("Date range must be between 1 and 31 days", 400);
    }

    const salaryMonthDate = new Date(month_salary);
    if (salaryMonthDate > new Date()) {
      throw new AppError("Cannot generate salary for future months", 400);
    }

    const salaryMonthStr = `${salaryMonthDate.getFullYear()}-${String(salaryMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

    return transaction(async (client) => {
      const service = new SalaryService();
      const generated = await service.generateSalary({ ...rest, remark, from_date, to_date, salaryMonthStr }, client);
      return { data: generated };
    });
  }
  async confimSalary(data: ConfirmSalary) {

    const { status, updated_by, transaction_reference, payment_method_id, ...rest } = data;

    return transaction(async (client) => {

      let statusCode = 99;
      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const remark = {
        action: statusCode === 7 ? "Salary Confirmed" : "Salary Paid",
        updated_by,
        updated_at: Date.now(),
      };
      const service = new SalaryService();

      const salary = await service.confirmSalary(
        {
          ...rest,
          statusCode,
          remark
        },
        client
      );
      if (status === "Paid") {
        const entity_type = convertEntityType("Branch" as EntityKey);

        const payment_transactions = new PaymentTransactionService()
        await payment_transactions.insertPaymentTransaction({
          ref_id: Number(salary.data.id),
          amount: rest.final_salary,
          ref_type: PaymentTransactionTypeCodeMap["salary"],
          status: statusCode,
          payment_method_id: payment_method_id ?? null,
          transaction_reference: transaction_reference ?? null,
          business_id: rest.branch_id,
          business_ref: entity_type,
          company_id: salary.company_id
        }, client)
      }

      return `Salary ${status} successfully. Amount: ${rest.final_salary}`;
    });
  }
}