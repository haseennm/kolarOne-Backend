import { getStatusCode, getStatusText } from "../../utils/extra";
import CustomerService from "./customer.service";
import {
  CreateCustomerBody,
  DeleteCustomerBody,
  EditCustomerBody,
  FetchCustomerParams,
} from "./customer.types";

export default class CustomerController {

  async fetchCustomer(data: FetchCustomerParams) {

    const service = new CustomerService();

    const customers_with_code = await service.fetchCustomer(data);

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

    const { updated_by, status, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };

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

}