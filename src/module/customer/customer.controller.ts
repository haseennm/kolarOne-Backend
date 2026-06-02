import { AppError } from "../../utils/AppError";
import { getStatusCode, getStatusText, isValidDateFormat } from "../../utils/extra";
import CustomerService from "./customer.service";
import {
  CreateCustomerBody,
  CustomerRemark,
  DeleteCustomerBody,
  EditCustomerBody,
  FetchCustomerParams,
  GetCustomerReport,
} from "./customer.types";

export default class CustomerController {

async fetchCustomer(data: FetchCustomerParams) {
  const {
    filters: { status, ...filters },
    offset,
  } = data;

const statusCode =
  typeof status === "string"
    ? getStatusCode(status)
    : status;

  const service = new CustomerService();

  const customers_with_code = await service.fetchCustomer({
    offset,
    filters: {
      ...filters,
      status: statusCode,
    },
  });

  const customers = customers_with_code.customers.map((row) => ({
    ...row,
    status: getStatusText(row.status),
  }));

  return {
    pagination: {
      page: customers_with_code.page,
      limit: customers_with_code.limit,
      total: customers_with_code.total,
    },
    data: {
      customers,
    },
  };
}

  async createCustomer(data: CreateCustomerBody) {

    const { created_by, status, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };

    const statusCode = getStatusCode(status);

    const service = new CustomerService();

    const customer = await service.createCustomer({
      ...rest,
      remark,
      statusCode,
    });

    return customer;
  }

  async editCustomer(data: EditCustomerBody) {

    const { updated_by, status, blacklist_reason, ...rest } = data;

    let remark: CustomerRemark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };
    if (status === "blacklist") {
      if (!blacklist_reason) {
        throw new AppError("Blacklist reason is require and must be string", 400)
      }
      remark = {
        action: "added to blacklist",
        reason: blacklist_reason,
        updated_by,
        updated_at: Date.now(),
      };

    }
    let statusCode;

    if (typeof status === "string") {
      statusCode = getStatusCode(status);
    }

    const service = new CustomerService();

    const customer = await service.updateCustomer({
      ...rest,
      remark,
      statusCode,
    });

    return customer;
  }

  async deleteCustomer(data: DeleteCustomerBody) {

    const { deleted_by, ...rest } = data;

    const remark = {
      action: "Deleted",
      deleted_by,
      updated_at: Date.now(),
    };

    const service = new CustomerService();

    const customer = await service.deleteCustomer({
      ...rest,
      remark,
    });

    return customer;
  }

  async getCustomerReport(data: GetCustomerReport) {
    const { ...rest } = data
    const hasDate =
      rest.start_date &&
      rest.end_date &&
      isValidDateFormat(rest.start_date) &&
      isValidDateFormat(rest.end_date);

    if ((rest.start_date || rest.end_date) && !hasDate) {
      throw new AppError("Invalid date format (YYYY-MM-DD)", 400)
    }
    const service = new CustomerService();

    return service.getCustomerReportSummary(data);
  }
}