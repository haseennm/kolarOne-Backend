import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreateFinancialYearBody,
  DeleteFinancialYearBody,
  EditFinancialYearBody,
  FetchFinancialYearBody
} from "./financialYear.types";
import FinancialYearController from "./financialYear.controller";

export async function financialYearRouter(app: FastifyInstance) {

  // CREATE FinancialYear
  app.post<{ Body: CreateFinancialYearBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "from_date",
            "end_date",
            "created_by"
          ],
          properties: {

            from_date: {
              type: "string",
              format: "date", // YYYY-MM-DD
              description: "Start date of the report"
            },

            end_date: {
              type: "string",
              format: "date",
              description: "End date of the report"
            },

            created_by: {
              type: "string",
              minLength: 1,
              description: "User ID who created the request"
            },
            company_id: {
              type: "number",
              minimum: 1,
              description: "Company ID"
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"],
              description: "Status filter"
            }

          },
          additionalProperties: false
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateFinancialYearBody }>,
      reply: FastifyReply
    ) => {

      const controller = new FinancialYearController();
      const data = await controller.createFinancialYear(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });

    }
  );

  // FETCH FinancialYear
  app.post<{ Body: FetchFinancialYearBody }>(
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
      request: FastifyRequest<{ Body: FetchFinancialYearBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new FinancialYearController();

      const data = await controller.fetchFinancialYear({
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

  // EDIT FinancialYear
  app.post<{ Body: EditFinancialYearBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "id",
            "updated_by",
            "company_id"
          ],
          properties: {

            from_date: {
              type: "string",
              format: "date", // YYYY-MM-DD
              description: "Start date of the report"
            },

            end_date: {
              type: "string",
              format: "date",
              description: "End date of the report"
            },

            created_by: {
              type: "string",
              minLength: 1,
              description: "User ID who created the request"
            },
            company_id: {
              type: "number",
              minimum: 1,
              description: "Company ID"
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"],
              description: "Status filter"
            }

          },
          additionalProperties: false
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EditFinancialYearBody }>,
      reply: FastifyReply
    ) => {

      const controller = new FinancialYearController();
      const data = await controller.editFinancialYear(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

  // DELETE FinancialYear
  app.post<{ Body: DeleteFinancialYearBody }>(
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
      request: FastifyRequest<{ Body: DeleteFinancialYearBody }>,
      reply: FastifyReply
    ) => {

      const controller = new FinancialYearController();
      const data = await controller.deleteFinancialYear(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

}