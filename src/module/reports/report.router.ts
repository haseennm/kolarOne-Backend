import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ReportController } from "./report.controller";
import { GetProfitLossBody } from "./report.types";

export default async function reportRoutes(app: FastifyInstance) {

  const controller = new ReportController();

  app.post(
    "/pl",
    {
      schema: {
        body: {
          type: "object",
          required: ["level"],
          properties: {
            level: {
              type: "string",
              enum: ["company", "branch", "firm"]
            },

            company_id: {
              type: ["number", "null"]
            },

            branch_id: {
              type: ["number", "null"]
            },

            firm_id: {
              type: ["number", "null"]
            },

            start_date: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            },

            end_date: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            }
          },

          allOf: [
            {
              if: {
                properties: { level: { const: "company" } }
              },
              then: {
                required: ["company_id"]
              }
            },
            {
              if: {
                properties: { level: { const: "branch" } }
              },
              then: {
                required: ["branch_id"]
              }
            },
            {
              if: {
                properties: { level: { const: "firm" } }
              },
              then: {
                required: ["firm_id"]
              }
            }
          ]
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: GetProfitLossBody }>,
      reply: FastifyReply
    ) => {

      const data = await controller.getProfitLossReport(request.body);

      return reply.code(201).send({
        status: "Success",
        data
      });

    }
  );
  app.post(
    "/receivables",
    {
      schema: {
        body: {
          type: "object",
          required: ["level"],
          properties: {
            level: {
              type: "string",
              enum: ["company", "branch", "firm"]
            },

            company_id: {
              type: ["number", "null"]
            },

            branch_id: {
              type: ["number", "null"]
            },

            firm_id: {
              type: ["number", "null"]
            },

            start_date: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            },

            end_date: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            }
          },

          allOf: [
            {
              if: {
                properties: { level: { const: "company" } }
              },
              then: {
                required: ["company_id"]
              }
            },
            {
              if: {
                properties: { level: { const: "branch" } }
              },
              then: {
                required: ["branch_id"]
              }
            },
            {
              if: {
                properties: { level: { const: "firm" } }
              },
              then: {
                required: ["firm_id"]
              }
            }
          ]
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: GetProfitLossBody }>,
      reply: FastifyReply
    ) => {

      const data = await controller.getReceivablesReport(request.body);

      return reply.code(201).send({
        status: "Success",
        data
      });

    }
  );

}