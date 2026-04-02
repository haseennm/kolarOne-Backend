import { FastifyInstance } from "fastify";
import ProfitShareController from "./partnerProfitShare.controller";
import { CreateProfitShareBody, DeletePartnerProfitBody, EditProfitShareBody, ProfitShareFilters } from "./partnerProfitShare.types";

export async function profitShareRouter(app: FastifyInstance) {
  const controller = new ProfitShareController();

  app.post("/create", {
    schema: {
      body: {
        type: "object",
        required: ["partner_id", "entity_id", "entity_type", "profit_share", "status", "created_by", "parent_id"],
        properties: {
          partner_id: { type: "string", format: "uuid" },
          entity_id: { type: "number" },
          parent_id: { type: "number" }, // Optional, used for Firm validation
          entity_type: { type: "string", enum: ["Branch", "Firm", "Company"] },
          profit_share: { type: "number", minimum: 0, maximum: 100 },
          status: { type: "string", enum: ["Active", "Inactive"] },
          created_by: { type: "string" }
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
        required: ["id", "entity_id", "entity_type", "updated_by"],
        properties: {
          id: { type: "number" },
          entity_id: { type: "number" },
          entity_type: { type: "string", enum: ["Branch", "Firm", "Company"] },
          profit_share: { type: "number", minimum: 0, maximum: 100 },
          status: { type: "string", enum: ["Active", "Inactive"] },
          updated_by: { type: "string" }
        }
      }
    }
  }, async (req, reply) => {

    const body = req.body as EditProfitShareBody;

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
          properties: {
            partner_id: { type: "number" },
            partner_name: { type: "string" },
            profit_share_gt: { type: "number" },
            profit_share_lt: { type: "number" },
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 10 }
          }
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