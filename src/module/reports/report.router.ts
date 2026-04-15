import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ReportController } from "./report.controller";
import { GetGSTReportBody, GetReportBody, OpportunityForecastInput, PaymentReportInput, SalesTrendInput } from "./report.types";

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
      request: FastifyRequest<{ Body: GetReportBody }>,
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
      request: FastifyRequest<{ Body: GetReportBody }>,
      reply: FastifyReply
    ) => {

      const data = await controller.getReceivablesReport(request.body);

      return reply.code(201).send({
        status: "Success",
        data
      });

    }
  );
  app.post(
    "/expenses",
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
      request: FastifyRequest<{ Body: GetReportBody }>,
      reply: FastifyReply
    ) => {

      const data = await controller.getExpenseReport(request.body);

      return reply.code(201).send({
        status: "Success",
        data
      });

    }
  );
  app.post(
    "/gst",
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
            type: {
              type: "string",
              enum: ["GSTR-1", "GSTR-3B"]
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
      request: FastifyRequest<{ Body: GetGSTReportBody }>,
      reply: FastifyReply
    ) => {

      const data = await controller.getGSTReport(request.body);

      return reply.code(201).send({
        status: "Success",
        data
      });

    }
  );
  app.post(
    "/sales-trend",
    {
      schema: {
        body: {
          type: "object",
          required: ["level", "company_id"],
          properties: {
            level: {
              type: "string",
              enum: ["company", "branch", "firm"]
            },

            company_id: {
              type: "number"
            },

            branch_id: {
              type: ["number", "null"]
            },

            firm_id: {
              type: ["number", "null"]
            },

            months: {
              type: "number",
              minimum: 1,
              default: 6
            }
          },

          allOf: [
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
      request: FastifyRequest<{ Body: SalesTrendInput }>,
      reply: FastifyReply
    ) => {
      const data = await controller.salesTrend(request.body);
      return reply.code(200).send({
        status: "Success",
        data
      });

    }
  );
  app.post(
    "/sales-forecast",
    {
      schema: {
        body: {
          type: "object",
          required: ["level", "company_id"],
          properties: {
            level: {
              type: "string",
              enum: ["company", "branch", "firm"]
            },

            company_id: {
              type: "number"
            },

            branch_id: {
              type: ["number", "null"]
            },

            firm_id: {
              type: ["number", "null"]
            },

            forecast_months: {
              type: "number",
              minimum: 1,
              default: 6
            }
          },

          allOf: [
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
      request: FastifyRequest<{ Body: SalesTrendInput }>,
      reply: FastifyReply
    ) => {
      const data = await controller.salesForecast(request.body);
      return reply.code(200).send({
        status: "Success",
        data
      });

    }
  );
  app.post(
    "/opportunity-forecast",
    {
      schema: {
        body: {
          type: "object",
          required: ["level", "company_id"],
          properties: {
            level: {
              type: "string",
              enum: ["company", "branch", "firm"]
            },

            company_id: {
              type: "number"
            },

            branch_id: {
              type: ["number", "null"]
            },

            firm_id: {
              type: ["number", "null"]
            },

            top_items_limit: {
              type: "number",
              minimum: 1,
              default: 10
            }
          },

          allOf: [
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
      request: FastifyRequest<{ Body: OpportunityForecastInput }>,
      reply: FastifyReply
    ) => {
      const data = await controller.opportunityForecast(request.body);
      return reply.code(200).send({
        status: "Success",
        data
      });

    }
  );
  app.post(
    "/payments",
    {
      schema: {
        body: {
          type: "object",
          required: ["level", "company_id"],
          properties: {
            level: {
              type: "string",
              enum: ["company", "branch", "firm"]
            },

            company_id: {
              type: "number"
            },

            branch_id: {
              type: ["number", "null"]
            },

            firm_id: {
              type: ["number", "null"]
            },

            flow: {
              type: "string",
              enum: ["in", "out", "all"],
              default: "all"
            },

            method_filter: {
              type: ["number", "null"],
              default: null
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
      request: FastifyRequest<{ Body: PaymentReportInput }>,
      reply: FastifyReply
    ) => {

      const data = await controller.paymentReport(request.body);

      return reply.code(200).send({
        status: "Success",
        data
      });

    }
  );
}