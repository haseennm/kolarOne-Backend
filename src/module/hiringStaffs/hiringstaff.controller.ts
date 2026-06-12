import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { Cryption } from "../../utils/cryption";
import { convertEntityType, EntityKey, getStatusText } from "../../utils/extra";
import StaffService from "./hiringstaff.service";
import { CreateHireStaffBody, DeleteHireStaffBody, EditStatusHireStaffBody, EncryptHireStaffBody } from "./hiringstaff.types";

export default class HiringStaffController {


  async createHireStaff(data: CreateHireStaffBody) {

  let { entity_type, ...rest } = data;

  const requiredFields = [
    "full_name",
    "phone_number",
    "email",
    "date_of_birth",
    "expected_salary",
    "working_from",
    "working_to",
    "entity_type",
    "entity_id",
    "company_id"
  ];

  for (const field of requiredFields) {

    const value = data[field as keyof CreateHireStaffBody];

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      throw new AppError(`${field} is required`, 400);
    }
  }


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
    created_at: Date.now(),
  };

  return transaction(async (client) => {

    entity_type = convertEntityType(entity_type as EntityKey);

    const service = new StaffService();

    let entity_table = "";

    if (entity_type === "C") entity_table = "company";
    if (entity_type === "B") entity_table = "branches";
    if (entity_type === "F") entity_table = "firm";

    const staff_created = await service.createHireStaff({
      ...rest,
      remark,
      entity_type,
      entity_table,
    }, client);

    return `Staff ${staff_created.full_name} has been created successfully.`;
  });
}

  async fetchHireStaff(data: any) {

    const service = new StaffService();

    const staff_with_code = await service.fetchHireStaff(data);
    const staff = staff_with_code.staff.map(({ ...rest }) => ({
      ...rest,
      status: getStatusText(rest.status),
    }));

    return {
      staff,
      pagination: { ...staff_with_code.pagination }
    };
  }

  async editHireStaff(data: EditStatusHireStaffBody) {

    let {
      id,
      entity_type,
      updated_by,
      status,
      ...rest
    } = data;
    const remark = {
      action: `Change status to${status}`,
      updated_by,
      updated_at: Date.now(),
    };
    let entity_table = ""
    if (entity_type === "C") entity_table = "company"
    if (entity_type === "B") entity_table = "branches"
    if (entity_type === "F") entity_table = "firm"

    return transaction(async (client) => {

      const service = new StaffService();

      await service.updateHireStaffStatus(
        {
          ...rest,
          id,
          remark,
          entity_type,
          status
        },
        client
      );

      return `Staff has been updated successfully.`;
    });
  }


  async deleteHireStaff(data: DeleteHireStaffBody) {

    const { deleted_by, ...rest } = data;

    return transaction(async (client) => {

      const remark = {
        action: "Deleted",
        deleted_by,
        deleted_at: Date.now(),
      };

      const service = new StaffService();

      const staff = await service.deleteHireStaff(
        {
          ...rest,
          remark,
        },
        client
      );

      return `Staff ${staff.full_name} has been deleted successfully.`;
    });
  }
  async encryptUrl(data: EncryptHireStaffBody) {
    const cryption = new Cryption
    const encrypted = cryption.encrypt(data)
    return `http://192.168.0.103:5173/apply?${encrypted}`
  }
  async decryptUrl(data: string) {
    const cryption = new Cryption
    const cleanedData = data.replace("http://192.168.0.103:5173/apply?", "");
    const decrypt = cryption.decrypt(cleanedData);
    return decrypt
  }

}