import { FastifyInstance } from "fastify";
import CapitalLedgerController from "./partnersLedger.controller";
import { DeleteCapitalLedgerBody, EditCapitalLedgerBody, FetchLedgerRequest } from "./partnersLedger.types";

export async function partnerLedgerRouter(app: FastifyInstance) {
  const controller = new CapitalLedgerController();

  // CREATE
  app.post("/create", {
    schema: {
      body: {
        type: "object",
        required: ["partner_id", "amount", "flow_type", "status", "created_by", "entity_id", "entity_type"],
        properties: {
          partner_id: { type: "string", format: "uuid" },
          amount: { type: "number", minimum: 0.01 },
          flow_type: { type: "string", enum: ["Capital", "Drawing", "Settlement"] },
          description: { type: "string" },
          entity_type: { type: "string", enum: ["Branch", "Firm", "Company"] },
          entity_id: { type: "number" },
          status: {
              type: "string",
              enum: ["Paid", "Cancelled"]
            },
          created_by: { type: "string" }
        }
      }
    }
  }, async (req, reply) => {
    const res = await controller.createEntry(req.body as any);
    return reply.code(201).send({ status: "Success", message: res });
  });

  // FETCH (GET)
  app.post<{
    Body: FetchLedgerRequest;
  }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            partner_id: { type: "string", format: "uuid" },

            entity_id: { type: "number" },
            entity_type: { type: "string" },

            flow_type: {
              type: "string",
              enum: ["CAPITAL", "DRAWING", "SETTLEMENT"]
            },

            group_type: {
              type: "string",
              enum: ["INCOME", "EXPENSE"]
            },

            page: {
              type: "integer",
              minimum: 1,
              default: 1
            },

            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 10
            }
          },

          additionalProperties: false,

          dependencies: {
            entity_id: ["entity_type"],
            entity_type: ["entity_id"]
          }
        }
      }
    },
    async (req, reply) => {
      const result = await controller.fetchEntries(req.body);
      return reply.send(result);
    }
  );

  // EDIT
  app.post<{Body:EditCapitalLedgerBody}>("/edit", {
    schema: {
      body: {
        type: "object",
        required: ["id", "updated_by", "entity_id", "entity_type"],
        properties: {
          id: { type: "string" },
          amount: { type: "number" },
          description: { type: "string" },
           status: {
              type: "string",
              enum: ["Paid", "Cancelled"]
            },
          entity_type: { type: "string", enum: ["Branch", "Firm", "Company"] },
          entity_id: { type: "number" },
          updated_by: { type: "string" }
        }
      }
    }
  }, async (req, reply) => {
    const res = await controller.editEntry(req.body as any);
    return reply.send({ status: "Success", message: res });
  });

  // DELETE
  app.post<{Body:DeleteCapitalLedgerBody}>("/delete", {
    schema: {
      body: {
        type: "object",
        required: ["id", "deleted_by","entity_id"],
        properties: {
          id: { type: "number" },
          entity_id: { type: "number" },
          deleted_by: { type: "string" }
        }
      }
    }
  }, async (req, reply) => {
    const res = await controller.deleteEntry(req.body);
    return reply.send({ status: "Success", message: res });
  });
}