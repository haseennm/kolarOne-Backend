import { transaction } from "../../config/db";
import { getStatusCode, getStatusText } from "../../utils/extra";
import RoleService from "./role.service";
import {
  CreateRoleBody,
  DeleteRoleBody,
  EditRoleBody,
  FetchRoleParams
} from "./role.types";

export default class RoleController {

  async createRole(data: CreateRoleBody) {

    const { status, ...rest } = data;

    return transaction(async (client) => {

      const statusCode = getStatusCode(status);

      const service = new RoleService();

      const role = await service.createRole(
        {
          ...rest,
          statusCode
        },
        client
      );

      return `Role ${role.role} has been created successfully.`;
    });
  }

  async editRole(data: EditRoleBody) {

    const { status, ...rest } = data;

    return transaction(async (client) => {

      let statusCode = 99;

      if (typeof status === "string") {
        statusCode = getStatusCode(status);
      }

      const service = new RoleService();

      await service.updateRole(
        {
          ...rest,
          statusCode
        },
        client
      );

      return `Role has been updated successfully.`;
    });
  }

  async fetchRole(data: FetchRoleParams) {

    const service = new RoleService();

    const rolesWithCode = await service.fetchRole(data);

    const roles = rolesWithCode.roles.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      roles,
      pagination: { ...rolesWithCode.pagination }
    };
  }

  async deleteRole(data: DeleteRoleBody) {

    return transaction(async () => {

      const service = new RoleService();

      const role = await service.deleteRole(data);

      return `Role ${role.role} has been deleted successfully.`;
    });
  }
}