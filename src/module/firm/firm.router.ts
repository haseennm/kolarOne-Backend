import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { cns, el } from "../../utils/extra";
import {
  CreateFirmBody,
  DeleteFirmBody,
  EditFirmBody,
  FetchFirmBody,
  FirmLoginBody,
} from "./firm.types";
import FirmController from "./firm.controller";

export async function firmRouter(app: FastifyInstance): Promise<void> {

  // CREATE
  app.post<{ Body: CreateFirmBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "branch_id",
            "status",
            "created_by",
            "company_id",
            "name_of_manager",
            "phone_number",
            "firm_name",
            "firm_code",
            "username",
            "password",
          ],
          properties: {
            branch_id: {
              type: "integer",
              minimum: 1,
            },
            company_id: {
              type: "integer",
              minimum: 1,
            },

            firm_code: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },
            firm_name: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },
            username: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },
            password: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },
            name_of_manager: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },

            phone_number: {
              type: "string",
              pattern: "^[0-9]{10,15}$",
            },

            email: {
              type: "string",
              format: "email",
            },

            website: {
              type: "string",
              format: "uri",
            },

            logo: {
              type: "string",
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"],
            },

            created_by: {
              type: "string",
              minimum: 1,
            },
            gstin: {
              type: ['string', 'null']
            },

            pan_number: {
              type: ['string', 'null']
            },

            address: {
              type: ['string', 'null'],
              minLength: 3
            },

            city: {
              type: ['string', 'null'],
              minLength: 2
            },

            district: {
              type: ['string', 'null'],
              minLength: 2
            },

            state: {
              type: ['string', 'null'],
              minLength: 2
            },

            state_code: {
              type: ['string', 'null'],
              minLength: 1
            }
          },
        },
      },
    },
    async (request, reply) => {
      try {
        cns(request.url, request.body);
        const controller = new FirmController();
        const firm = await controller.createFirm(request.body);
        return reply.code(201).send(firm);
      } catch (err: any) {
        el(err);
        return reply
          .status(err.statusCode || 500)
          .send({ message: err.message || "Internal Server Error" });
      }
    }
  );

  // FETCH
  app.post<{ Body: FetchFirmBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1 },
            id: { type: "number" },
            branch_id: { type: "number" },
            search: { type: ["string", "null"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: FetchFirmBody }>,
      reply: FastifyReply
    ) => {
      try {
        cns(request.url, request.body);

        const { page = 1, limit = 10, ...filters } = request.body;
        const offset = (page - 1) * limit;

        const controller = new FirmController();

        const firms = await controller.fetchFirm({
          offset,
          filters: {
            ...filters,
            page,
            limit,
          },
        });

        return reply.code(200).send(firms);
      } catch (err: any) {
        el(err);
        return reply
          .status(err.statusCode || 500)
          .send({ message: err.message || "Internal Server Error" });
      }
    }
  );

  // EDIT
  app.post<{ Body: EditFirmBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "branch_id", "updated_by"],
          properties: {
            id: { type: "number" },
            branch_id: { type: "number" },

            firm_name: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },
            firm_code: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },
            name_of_manager: {
              type: "string",
              minLength: 2,
              maxLength: 150,
            },

            phone_number: {
              type: "string",
              pattern: "^[0-9]{10,15}$",
            },

            email: {
              type: "string",
              format: "email",
            },

            website: {
              type: "string",
              format: "uri",
            },

            logo: {
              type: "string",
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"],
            },

            updated_by: {
              type: "string",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        cns(request.url, request.body);
        const controller = new FirmController();
        const firm = await controller.editFirm(request.body);
        return reply.code(201).send(firm);
      } catch (err: any) {
        el(err);
        return reply
          .status(err.statusCode || 500)
          .send({ message: err.message || "Internal Server Error" });
      }
    }
  );

  // DELETE
  app.post<{ Body: DeleteFirmBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "deleted_by", "branch_id"],
          properties: {
            r_id: { type: "number" },
            branch_id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        cns(request.url, request.body);
        const controller = new FirmController();
        const firm = await controller.deleteFirm(request.body);
        return reply.code(201).send(firm);
      } catch (err: any) {
        el(err);
        return reply
          .status(err.statusCode || 500)
          .send({ message: err.message || "Internal Server Error" });
      }
    }
  );
  app.post<{ Body: FirmLoginBody }>(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["password", "username"],
          properties: {
            password: { type: "string" },
            username: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        cns(request.url, request.body);
        const controller = new FirmController();
        const firm = await controller.loginFirm(request.body);
        return reply.code(201).send(firm);
      } catch (err: any) {
        el(err);
        return reply
          .status(err.statusCode || 500)
          .send({ message: err.message || "Internal Server Error" });
      }
    }
  );
}