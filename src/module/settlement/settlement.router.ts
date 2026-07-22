import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import SettlementController from "./settlement.controller";
import { SettlementFetchBody, PurchaseSettlementSyncBody, SaleSettlementSyncBody } from "./settlement.types";

const settlementRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // 1. Fetch remaining amounts & pending bills for a vendor
  app.post<{ Body: SettlementFetchBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["firm_id", "is_purchase"],
          properties: {
            firm_id: { type: "number" },
            is_purchase: { type: "boolean" }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: SettlementFetchBody }>,
      reply: FastifyReply
    ) => {
      const controller = new SettlementController();
      const data = await controller.fetchRemainingAmounts(request.body);

      return reply.code(200).send(data);
    }
  );

  // 2. Sync / Offset a Purchase Bill against a Purchase Return Bill
  app.post<{ Body: PurchaseSettlementSyncBody }>(
    "/purchase/sync",
    {
      schema: {
        body: {
          type: "object",
          required: ["firm_id", "company_id", "updated_by", "payments"],
          properties: {
            firm_id: { type: "number" },
            company_id: { type: "number" },
            purchase_id: { type: "number" },
            purchase_return_id: { type: "number" },
            updated_by: { type: "number" },
            payments: {
              type: "array",
              items: {
                type: "object",
                required: ["payment_method_id", "payment_amount"],
                properties: {
                  payment_method_id: { type: "number" },
                  payment_amount: { type: "number", minimum: 0 },
                  transaction_reference: { type: ["string", "null"] }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: PurchaseSettlementSyncBody }>, reply: FastifyReply) => {
      const controller = new SettlementController();
      const data = await controller.syncPurchaseAndReturn(request.body);
      return reply.code(200).send(data);
    }
  );
  app.post<{ Body: SaleSettlementSyncBody }>(
    "/sale/sync",
    {
      schema: {
        body: {
          type: "object",
          required: ["firm_id", "company_id", "updated_by", "payments"],
          properties: {
            firm_id: { type: "number" },
            company_id: { type: "number" },
            sale_id: { type: "number" },
            sale_return_id: { type: "number" },
            updated_by: { type: "number" },
            payments: {
              type: "array",
              items: {
                type: "object",
                required: ["payment_method_id", "payment_amount"],
                properties: {
                  payment_method_id: { type: "number" },
                  payment_amount: { type: "number", minimum: 0 },
                  transaction_reference: { type: ["string", "null"] }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: SaleSettlementSyncBody }>, reply: FastifyReply) => {
      const controller = new SettlementController();
      const data = await controller.syncSaleAndReturn(request.body);
      return reply.code(200).send(data);
    }
  );
};

export default settlementRoutes;