import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { generateToken, hashPassword, verifyPassword } from "../../utils/auth.util";
import { cns, convertEntityCode, convertEntityType, EntityKey, getStatusCode, getStatusText } from "../../utils/extra";
import StaffService from "./staff.service";
import { CreateStaffBody, DeleteStaffBody, EditStaffBody, StaffLoginBody } from "./staff.types";

export default class LedgerTransactionController {


  async createStaff(data: CreateStaffBody) {
    cns("request.body",data)
    let { created_by, status, entity_type, password, ...rest } = data;
    const validBloodGroups = [
      "A+", "A-",
      "B+", "B-",
      "AB+", "AB-",
      "O+", "O-"
    ];

    if (data.blood_group && !validBloodGroups.includes(data.blood_group)) {
      throw new AppError("Invalid blood group", 400);
    }
    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };

    return transaction(async (client) => {
      let hashed = undefined
      if (password) { hashed = await hashPassword(password) }

      const statusCode = getStatusCode(status ?? "Active");
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

    const validBloodGroups = [
      "A+", "A-",
      "B+", "B-",
      "AB+", "AB-",
      "O+", "O-"
    ];

    if (data.blood_group && !validBloodGroups.includes(data.blood_group)) {
      throw new AppError("Invalid blood group", 400);
    }
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

      let statusCode = undefined;

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
          entity_type,
          statusCode
        },
        client
      );

      return `Staff has been updated successfully.`;
    });
  }


  async deleteStaff(data: DeleteStaffBody) {

    const { deleted_by, ...rest } = data;

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
      role: staff.role,
      id: staff.id,
      entity_type: convertEntityCode(staff.entity_type) ?? staff.entity_type,
      message: `staff ${staff.full_name} Login success`
    }
  }

}