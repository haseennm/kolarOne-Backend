import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ReportController } from "./rentReport.controller";
import { DashboardBody, RentReportInput, sharedSchemaBody } from "./rentReport.types";

export async function rentReportRouter(app: FastifyInstance): Promise<void> {
  const controller = new ReportController();
  app.post(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id", "level"],
          properties: {
            company_id: {
              type: "number"
            },
            branch_id: {
              type: ["number", "null"]
            },
            level: {
              type: "string",
              enum: ["company", "branch"]
            },
            cashflow: {
              type: ["string", "null"],
              enum: ["income", "expense"]
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
            }
          ]
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: RentReportInput }>,
      reply: FastifyReply
    ) => {
      const data = await controller.getRentReport(request.body);

      return reply.code(200).send({
        status: "Success",
        data
      });
    }
  );
  app.post(
    "/product",
    {
      schema: {
        body: {
          type: "object",
          required: ["level"],
          properties: {
            company_id: { type: "number" },
            branch_id: { type: "number" },
            level: { type: "string", enum: ["company", "branch"] }
          }
        }
      }
    },
    async (request, reply) => {
      const data = await controller.getProductWiseReport(request.body);
      return reply.code(200).send({ status: "Success", data });
    }
  );


  // 1. Return Items Route
  app.post("/returns", { schema: { body: sharedSchemaBody } }, async (req, reply) => {
    const data = await controller.getReturnItemsReport(req.body);
    return reply.code(200).send({ status: "Success", data });
  });

  // 2. Damage / Missing Route
  app.post("/damage-missing", { schema: { body: sharedSchemaBody } }, async (req, reply) => {
    const data = await controller.getDamageMissingReport(req.body);
    return reply.code(200).send({ status: "Success", data });
  });

  // 3. Overday Route
  app.post("/overdays", { schema: { body: sharedSchemaBody } }, async (req, reply) => {
    const data = await controller.getOverdayReport(req.body);
    return reply.code(200).send({ status: "Success", data });
  });
  app.post<{ Body: DashboardBody }>(
  "/dashboard",
  {
    schema: {
      body: {
        type: "object",
        required: ["branch_id", "company_id"],
        properties: {
          company_id: { type: "number" },
          branch_id: { type: "number" }
        }
      }
    }
  },
  async (req, reply) => {
    const data = await controller.getDashbordReport(req.body);

    return reply.code(200).send({
      status: "Success",
      data
    });
  }
);
}
