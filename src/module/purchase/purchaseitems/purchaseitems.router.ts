import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreateRoleBody,
  DeleteRoleBody,
  EditRoleBody,
  FetchRoleBody
} from "./purchaseitems.types";
import RoleController from "./purchaseitems.controller";

export async function roleRouter(app: FastifyInstance) {

  // CREATE ROLE
  app.post<{ Body: CreateRoleBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["role", "company_id", "status"],
          properties: {

            role: {
              type: "string",
              minLength: 1,
              maxLength: 100
            },

            description: {
              type: "string",
              maxLength: 300

            },

            company_id: {
              type: "number"
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"]
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateRoleBody }>,
      reply: FastifyReply
    ) => {

      const controller = new RoleController();
      const data = await controller.createRole(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });

    }
  );

  // FETCH ROLE
  app.post<{ Body: FetchRoleBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id"],
          properties: {

            id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },
            branch_id: {
              type: "number"
            },

            // status: {
            //   type: "number"
            // },

            search: {
              type: "string"
            },

            page: {
              type: "number",
              minimum: 1
            },

            limit: {
              type: "number",
              minimum: 1
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: FetchRoleBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new RoleController();

      const data = await controller.fetchRole({
        offset: (page - 1) * limit,
        filters: {
          ...filters,
          page,
          limit
        }
      });

      return reply.code(200).send(data);

    }
  );

  // EDIT ROLE
  app.post<{ Body: EditRoleBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "company_id"],
          properties: {

            id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },

            role: {
              type: "string"
            },

            description: {
              type: "string"
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"]
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EditRoleBody }>,
      reply: FastifyReply
    ) => {

      const controller = new RoleController();
      const data = await controller.editRole(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

  // DELETE ROLE
  app.post<{ Body: DeleteRoleBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "company_id"],
          properties: {

            id: {
              type: "number"
            },

            company_id: {
              type: "number"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: DeleteRoleBody }>,
      reply: FastifyReply
    ) => {

      const controller = new RoleController();
      const data = await controller.deleteRole(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

}