import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import LedgerCategoryController from "./ledgerCategory.controller";
import {
  CreateLedgerCategoryBody,
  FetchLedgerCategoryBody,
  EditLedgerCategoryBody,
  DeleteLedgerCategoryBody
} from "./ledgerCategory.types";

export async function ledgerCategoryRouter(app: FastifyInstance) {

  // CREATE
  app.post<{ Body: CreateLedgerCategoryBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["category_type", "name", "company_id", "created_by"],
          properties: {

            category_type: {
              type: "string",
              enum: ["E", "I"]
            },

            name: {
              type: "string",
              minLength: 2,
              maxLength: 150
            },

            company_id: {
              type: "number"
            },

            status: {
              type: "string",
              enum: ["Active","Inactive"]
            },
            created_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: CreateLedgerCategoryBody }>, reply: FastifyReply) => {

      const controller = new LedgerCategoryController();
      const data = await controller.createCategory(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });

    }
  );


  // FETCH
  app.post<{ Body: FetchLedgerCategoryBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id"],
          properties: {

            page: {
              type: "number",
              minimum: 1
            },

            limit: {
              type: "number",
              minimum: 1
            },

            id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },

            search: {
              type: ["string","null"]
            },

            status: {
              type: "number",
              enum: [0,1,2]
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: FetchLedgerCategoryBody }>, reply: FastifyReply) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new LedgerCategoryController();

      const data = await controller.fetchCategory({
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


  // EDIT
  app.post<{ Body: EditLedgerCategoryBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id","updated_by"],
          properties: {

            id: {
              type: "number"
            },

            category_type: {
              type: "string",
              enum: ["E","I"]
            },

            name: {
              type: "string",
              minLength: 2,
              maxLength: 150
            },

            status: {
              type: "string",
              enum: ["Active","Inactive"]
            },

            remarks: {
              type: ["object","null"]
            },

            updated_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: EditLedgerCategoryBody }>, reply: FastifyReply) => {

      const controller = new LedgerCategoryController();
      const data = await controller.editCategory(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );


  // DELETE
  app.post<{ Body: DeleteLedgerCategoryBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id","company_id","deleted_by"],
          properties: {

            r_id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },

            deleted_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: DeleteLedgerCategoryBody }>, reply: FastifyReply) => {

      const controller = new LedgerCategoryController();
      const data = await controller.deleteCategory(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

}