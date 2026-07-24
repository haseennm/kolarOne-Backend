import { FastifyInstance } from "fastify";
import ProfitShareController from "./partnerProfitShare.controller";
import { CreateProfitShareBody, DeletePartnerProfitBody, EditProfitShareBulkBody, ProfitShareFilters } from "./partnerProfitShare.types";

export async function profitShareRouter(app: FastifyInstance) {
  const controller = new ProfitShareController();

  app.post("/create", {
    schema: {
      body: {
        type: "object",
        required: ["partner_id", "entities", "created_by"],
        properties: {
          partner_id: { type: "string", format: "uuid" },
          entities: {
            type: "array",
            items: {
              type: "object",
              required: ["entity_id", "entity_type", "profit_share"],
              properties: {
                entity_id: { type: "number" },
                entity_type: { type: "string", enum: ["Branch", "Firm", "Company"] },
                profit_share: { type: "number", minimum: 0, maximum: 100 }
              }
            }
          },
          created_by: { type: "string" },
        }
      }
    }
  }, async (req, reply) => {
    const body = req.body as CreateProfitShareBody;


    const res = await controller.createProfitShare(body);

    return reply.code(201).send({
      status: "Success",
      message: res,
    });
  }
  );
  app.post("/edit", {
    schema: {
      body: {
        type: "object",
        required: ["updated_by", "entities"],
        properties: {
          updated_by: { type: "string" },
          entities: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "entity_id", "entity_type"],
              properties: {
                id: { type: "number" },
                entity_id: { type: "number" },
                entity_type: {
                  type: "string",
                  enum: ["Branch", "Firm", "Company"]
                },
                profit_share: { type: "number", minimum: 0, maximum: 100 },
                status: { type: "string", enum: ["Active", "Inactive"] }
              }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = req.body as EditProfitShareBulkBody;

    const res = await controller.editProfitShare(body);

    return reply.send({
      status: "Success",
      message: res
    });
  });

  app.post<{ Body: ProfitShareFilters }>(
    "/get",
    {
      schema:
      {
        body: {
          type: "object",
          required: ["entity_id", "entity_type"],
          properties: {
            partner_id: { type: "string" },
            partner_name: { type: "string" },
            profit_share_gt: { type: "number" },
            profit_share_lt: { type: "number" },
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
            entity_id: { type: "number" },
            entity_type: { type: "string", enum: ["Branch", "Firm", "Company"] }
          },

          allOf: [
            {
              if: {
                required: ["entity_type"]
              },
              then: {
                required: ["entity_id"]
              }
            },
            {
              if: {
                required: ["entity_id"]
              },
              then: {
                required: ["entity_type"]
              }
            }
          ]
        }
      }
    }, async (req, reply) => {
      const res = await controller.fetchProfitShares(req.body);
      return reply.send(res);
    });

  app.post<{ Body: DeletePartnerProfitBody }>("/delete", {
    schema: {
      body: {
        type: "object",
        required: ["id", "entity_id", "deleted_by"],
        properties: {
          id: { type: "number" },
          entity_id: { type: "number" },
          deleted_by: { type: "string" }
        }
      }
    }
  }, async (req, reply) => {
    const res = await controller.deletePartnerProfit(req.body);
    return reply.send({ status: "Success", message: res });
  });
}