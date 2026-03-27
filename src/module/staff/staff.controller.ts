import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { generateToken, hashPassword, verifyPassword } from "../../utils/auth.util";
import { cns, convertEntityType, EntityKey, getStatusCode, getStatusText, PaymentTransactionTypeCodeMap } from "../../utils/extra";
import { PaymentTransactionService } from "../paymentTransaction/paymenttransaction.services";
import StaffService from "./staff.service";
import { CreateStaffBody, DeleteStaffBody, EditStaffBody, StaffLoginBody } from "./staff.types";

export default class LedgerTransactionController {


  async createStaff(data: CreateStaffBody) {

    let { created_by, status, entity_type, password, ...rest } = data;
      console.log("first con")

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };

    return transaction(async (client) => {
      let hashed = undefined
      if (password) { hashed = await hashPassword(password) }

      const statusCode = getStatusCode(status);
      entity_type = convertEntityType(entity_type as EntityKey);
      const service = new StaffService();
      let entity_table = ""
      if (entity_type === "C") entity_table = "company"
      if (entity_type === "B") entity_table = "branches"
      if (entity_type === "F") entity_table = "firm"
      const staff_created = await service.createStaff({
        ...rest,
        remark,
        statusCode,
        entity_type,
        entity_table,
        password_hash: hashed
      }, client);
      return `Staff ${staff_created.full_name} has been created successfully.`;
    })
  }

  async fetchStaff(data: any) {

    const service = new StaffService();

    const staff_with_code = await service.fetchStaff(data);

   const staff = staff_with_code.staff.map(({ password_hash, ...rest }) => ({
  ...rest,
  status: getStatusText(rest.status),
}));

    return {
      staff,
      pagination: { ...staff_with_code.pagination }
    };
  }

  async editStaff(data: EditStaffBody) {

    let {
      id,
      entity_type,
      updated_by,
      status,
      company_id,
      ...rest
    } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };
    entity_type = convertEntityType(entity_type as EntityKey);
    let entity_table = ""
    if (entity_type === "C") entity_table = "company"
    if (entity_type === "B") entity_table = "branches"
    if (entity_type === "F") entity_table = "firm"

    return transaction(async (client) => {

      let statusCode = 99;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const service = new StaffService();

      await service.updateStaff(
        {
          ...rest,
          id,
          company_id,
          remark,
          statusCode,
          entity_table
        },
        client
      );

      return `Staff has been updated successfully.`;
    });
  }


  async deleteStaff(data: DeleteStaffBody) {

    const { deleted_by, company_id, ...rest } = data;

    return transaction(async (client) => {

      const remark = {
        action: "Deleted",
        deleted_by,
        deleted_at: Date.now(),
      };

      const service = new StaffService();

      const staff = await service.deleteStaff(
        {
          ...rest,
          company_id,
          remark,
        },
        client
      );

      return `Staff ${staff.full_name} has been deleted successfully.`;
    });
  }

  async loginStaff(data: StaffLoginBody) {
    const { password, email } = data
    const service = new StaffService();
    const staff = await service.loginStaff(data);
    const isValid = await verifyPassword(password, staff.password_hash)

    if (!isValid) {
      throw new AppError('Invalid credentials', 401)
    }

    const token = generateToken({
      id: staff.id,
      username: email,
    })

    return {
      token: token,
      message: `staff ${staff.full_name} Login success`
    }
  }
}