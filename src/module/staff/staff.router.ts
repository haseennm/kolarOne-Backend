import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreateStaffBody,
  DeleteStaffBody,
  EditStaffBody,
  FetchStaffBody,
  StaffLoginBody
} from "./staff.types";

import StaffController from "./staff.controller";

export async function staffRouter(app: FastifyInstance) {

  // CREATE STAFF 
  app.post<{ Body: CreateStaffBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "company_id",
            "entity_type",
            "entity_id",
            "email",
            "password",
            "full_name",
            "role",
            "created_by"
          ],
          properties: {

            company_id: { type: "number" },

            entity_type: {
              type: "string",
              enum: ["Company", "Branch", "Firm"]
            },

            entity_id: { type: "number" },

            branch_id: { type: "number" },

            email: {
              type: "string",
              format: "email"
            },

            password: {
              type: "string",
              minLength: 6
            },

            full_name: {
              type: "string",
              minLength: 2
            },

            role: {
              type: "array",
              items: { type: "number" }
            },

            phone_number: { type: "string" },

            address: { type: "string" },

            salary: { type: "number" },

            finger_id: { type: "string" },

            status: {
              type: "string",
              enum: ["Active", "Inactive"]
            },

            created_by: { type: "string" }

          },

          allOf: [
            {
              if: {
                properties: {
                  entity_type: { const: "Firm" }
                }
              },
              then: {
                required: ["branch_id"]
              }
            }
          ]
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateStaffBody }>,
      reply: FastifyReply
    ) => {

      const controller = new StaffController();
      const data = await controller.createStaff(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });

    }
  );



  // FETCH STAFF
  app.post<{ Body: FetchStaffBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id"],
          properties: {

            id: { type: "string" },

            company_id: { type: "number" },

            entity_type: { type: "string" },

            entity_id: { type: "number" },

            role: {
              type: "array",
              items: { type: "number" }
            },

            status: { type: "number" },

            search: { type: "string" },

            page: {
              type: "number",
              minimum: 1
            },

            limit: {
              type: "number",
              minimum: 1
            }

          },

          allOf: [
            {
              if: {
                required: ["entity_id"]
              },
              then: {
                required: ["entity_type"]
              }
            },
            {
              if: {
                required: ["entity_type"]
              },
              then: {
                required: ["entity_id"]
              }
            }
          ]

        }
      }
    },
    async (
      request: FastifyRequest<{ Body: FetchStaffBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new StaffController();

      const data = await controller.fetchStaff({
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



  // EDIT STAFF
  app.post<{ Body: EditStaffBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "company_id", "updated_by"],
          properties: {

            id: { type: "string" },

            company_id: { type: "number" },

            updated_by: { type: "string" },

            role: {
              type: "array",
              items: { type: "number" }
            },

            full_name: { type: "string" },

            address: { type: "string" },

            phone_number: { type: "string" },

            entity_type: {
              type: "string",
              enum: ["Company", "Branch", "Firm"]
            },

            entity_id: { type: "number" },

            finger_id: { type: "string" },

            salary: { type: "number" },

            status: {
              type: "string",
              enum: ["Active", "Inactive"]
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EditStaffBody }>,
      reply: FastifyReply
    ) => {

      const controller = new StaffController();
      const data = await controller.editStaff(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );



  // DELETE STAFF
  app.post<{ Body: DeleteStaffBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "company_id", "entity_id", "deleted_by"],
          properties: {

            r_id: { type: "string" },

            company_id: { type: "number" },

            entity_id: { type: "number" },

            deleted_by: { type: "string" }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: DeleteStaffBody }>,
      reply: FastifyReply
    ) => {

      const controller = new StaffController();
      const data = await controller.deleteStaff(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );


  app.post<{ Body: StaffLoginBody }>(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["password", "email"],
          properties: {
            password: { type: "string" },
            email: {
              type: "string",
              format: "email"
            },
          },
        },
      },
    },
    async (request, reply) => {
      const controller = new StaffController();
      const firm = await controller.loginStaff(request.body);
      return reply.code(201).send(firm);

    }
  );
}