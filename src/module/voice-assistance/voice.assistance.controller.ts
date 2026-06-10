import axios from "axios";
import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import SalaryService from "./voice.assistance.service";
import { ConfirmSalary, VoiceCommandReq, GetSalaryBody } from "./voice.assistance.types";
import { text } from "node:stream/consumers";

export default class SalaryController {
  async generateSalary(data: VoiceCommandReq) {
    const { message, ...rest } = data

    return transaction(async (client) => {
      try {
        const response = await axios.post(
          "http://192.168.0.104:8000/process",
          {
            "text": message
          },
          // {
          //   headers: {
          //     Authorization: `Bearer YOUR_TOKEN`,
          //     "Content-Type": "application/json",
          //   },
          // }
        );

        console.log("response.data ML",response.data);

        return {
          data: response.data,
          rest: rest
        };
      } catch (error: any) {
        console.error("API Error:", error.response?.data || error.message);

        throw new Error("Failed to generate salary");
      }
      const service = new SalaryService();
      // const generated = await service.generateSalary({ ...rest, remark, from_date, to_date, salaryMonthStr }, client);
      // return { data: generated };
    });
  }
  // async confimSalary(data: ConfirmSalary) {

  //   const { status, updated_by, transaction_reference, payment_method_id, company_id, ...rest } = data;

  //   return transaction(async (client) => {

  //     let statusCode = 99;
  //     if (typeof status === "string") {
  //       statusCode = getStatusCode(status);
  //     }

  //     const remark = {
  //       action: statusCode === 7 ? "Salary Confirmed" : "Salary Paid",
  //       updated_by,
  //       updated_at: Date.now(),
  //     };
  //     const service = new SalaryService();

  //     const salary = await service.confirmSalary(
  //       {
  //         ...rest,
  //         statusCode,
  //         remark
  //       },
  //       client
  //     );
  //     if (status === "Paid") {
  //       const entity_type = convertEntityType("Branch" as EntityKey);

  //       const payment_transactions = new PaymentTransactionService()
  //       await payment_transactions.insertPaymentTransaction({
  //         ref_id: Number(salary.data.id),
  //         amount: rest.final_salary,
  //         ref_type: PaymentTransactionTypeCodeMap["salary"],
  //         status: statusCode,
  //         payment_method_id: payment_method_id ?? null,
  //         transaction_reference: transaction_reference ?? null,
  //         business_id: rest.entity_id,
  //         business_ref: entity_type,
  //         company_id: company_id
  //       }, client)
  //     }

  //     return `Salary ${status} successfully. Amount: ${rest.final_salary}`;
  //   });
  // }
  // async getSalary(data: GetSalaryBody) {
  //   return transaction(async (client) => {
  //     const service = new SalaryService();
  //     const salary_with_code = await service.getSalary(
  //       data,
  //       client
  //     );

  //     const salary = salary_with_code.map((row) => ({
  //       ...row,
  //       status: getStatusText(row.status),
  //     }));

  //     return salary;
  //   });
  // }
}