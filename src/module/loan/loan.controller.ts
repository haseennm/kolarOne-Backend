import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import LoanService from "./loan.service";
import { CreateLoanBody, DeleteLoanBody, FetchLoanBody, FetchLoanParams, GetReportBody, RepayLoanBody } from "./loan.types";

export default class LoanController {

  async createLoan(data: CreateLoanBody) {

    const { created_by, ...rest } = data;

    return transaction(async (client) => {
      const remark = {
        action: "Created",
        created_by,
        created_at: Date.now(),
      };
      const statusCode = getStatusCode("Active");

      const service = new LoanService();

      const loan = await service.createLoan(
        {
          ...rest,
          statusCode,
          remark
        },
        client
      );

      const entity_type = convertEntityType("Branch" as EntityKey);

      const payment_transactions = new PaymentTransactionService()
      await payment_transactions.insertPaymentTransaction({
        ref_id: Number(loan.id),
        amount: rest.loan_amount,
        ref_type: PaymentTransactionTypeCodeMap["loan"],
        status: getStatusCode("Paid"),
        payment_method_id: null,
        transaction_reference: null,
        business_id: rest.branch_id,
        business_ref: entity_type,
        company_id: rest.company_id
      }, client)


      return `loan  has been created successfully.`;
    });
  }

  // async editLoan(data: EditLoanBody) {

  //   const { status, ...rest } = data;

  //   return transaction(async (client) => {

  //     let statusCode = 99;

  //     if (typeof status === "string") {
  //       statusCode = getStatusCode(status);
  //     }

  //     const service = new loanService();

  //     await service.updateloan(
  //       {
  //         ...rest,
  //         statusCode
  //       },
  //       client
  //     );

  //     return `loan has been updated successfully.`;
  //   });
  // }

  async fetchLoan(data: FetchLoanParams) {

    const service = new LoanService();

    const loanesWithCode = await service.fetchLoan(data);

    const loanes = loanesWithCode.loans.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      loanes,
      pagination: { ...loanesWithCode.pagination }
    };
  }

  async rePayLoan(data: RepayLoanBody) {

    return transaction(async (client) => {

      const { updated_by, pay_amount, ...rest } = data
      const service = new LoanService();
      const remarks = {
        action: `Paid ${pay_amount}`,
        updated_by,
        updated_at: Date.now(),
      };
      const loan = await service.repayLoan({ ...rest, remarks, pay_amount }, client);
      const entity_type = convertEntityType("Branch" as EntityKey);

      const payment_transactions = new PaymentTransactionService()
      await payment_transactions.insertPaymentTransaction({
        ref_id: Number(loan.id),
        amount: pay_amount,
        ref_type: PaymentTransactionTypeCodeMap["loanrepay"],
        status: getStatusCode("Paid"),
        payment_method_id: null,
        transaction_reference: null,
        business_id: rest.branch_id,
        business_ref: entity_type,
        company_id: rest.company_id
      }, client)
      return `Loan has been deleted successfully.`;
    });
  }
  async deleteLoan(data: DeleteLoanBody) {

    return transaction(async (client) => {

      const { delete_by, company_id, id, ...rest } = data
      const service = new LoanService();
      const remark = {
        action: "Deleted",
        delete_by,
        deleted_at: Date.now(),
      };
      await service.deleteLoan({ ...rest, id, remark, company_id }, client);
      const payment_transactions_service = new PaymentTransactionService()
      await payment_transactions_service.deletePaymentTransaction({
        company_id: company_id,
        ref_id: id,
        ref_type: PaymentTransactionTypeCodeMap["loan"],
      }, client)
      return `Loan has been deleted successfully.`;
    });
  }

  async getLoanReport(data:GetReportBody) {

    const { level, branch_id, company_id } = data;

    if (!level) {
      throw new AppError("level is required",400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required",400);
    }

    if (level === "company" && !company_id) {
      throw new AppError("company_id is required",400);
    }

    const service = new LoanService();

    return service.getLoanReport(data);
  }

}