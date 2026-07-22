import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CreateLedgerTransactionBody, DeleteLedgerTransactionBody, EditLedgerTransactionBody, FetchLedgerTransactionBody } from "./ledgertransaction.types";
import LedgerTransactionController from "./ledgertransaction.controller";


export async function ledgerTransactionRouter(app: FastifyInstance) {

  // CREATE
  app.post<{ Body: CreateLedgerTransactionBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "ledger_category_id",
            "amount",
            "transaction_date",
            "entity_type",
            "entity_id",
            "company_id",
            "status",
            "created_by"
          ],
          properties: {

            category_id: {
              type: "number"
            },

            amount: {
              type: "number"
            },

            transaction_date: {
              type: "string",
              format: "date"
            },

            reference_id: {
              type: ["string", "null"],
              minLength: 1,
              maxLength: 100
            },

            entity_type: {
              type: "string",
              enum: ["Company", "Branch", "Firm"]
            },

            entity_id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },

            status: {
              type: "string",
              enum: ["Unpaid", "Paid"]
            },

            created_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateLedgerTransactionBody }>,
      reply: FastifyReply
    ) => {
      const controller = new LedgerTransactionController();
      const data = await controller.createTransaction(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });

    }
  );


  // FETCH
  app.post<{ Body: FetchLedgerTransactionBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["level"],
          properties: {

            id: {
              type: "number"
            },
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

            from_date: {
              type: "string",
              format: "date"
            },

            to_date: {
              type: "string",
              format: "date"
            },
            category_id: {
              type: "number"
            },

            status: {
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
      request: FastifyRequest<{ Body: FetchLedgerTransactionBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new LedgerTransactionController();

      const data = await controller.fetchTransaction({
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
  app.post<{ Body: EditLedgerTransactionBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "company_id", "updated_by"],
          properties: {

            id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },

            updated_by: {
              type: "string"
            },

            category_id: {
              type: "number"
            },

            amount: {
              type: "number"
            },

            transaction_date: {
              type: "string",
              format: "date"
            },

            reference_id: {
              type: "string"
            },

            status: {
              type: "string",
              enum: ["Unpaid", "Paid"]
            },
            entity_type: {
              type: "string",
              enum: ["Company", "Branch", "Firm"]
            },

            entity_id: {
              type: "number"
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EditLedgerTransactionBody }>,
      reply: FastifyReply
    ) => {

      const controller = new LedgerTransactionController();
      const data = await controller.editTransaction(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );


  // DELETE
  app.post<{ Body: DeleteLedgerTransactionBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "company_id", "deleted_by", "entity_id"],
          properties: {

            r_id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },
            entity_id: {
              type: "number"
            },

            deleted_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: DeleteLedgerTransactionBody }>, reply: FastifyReply) => {

      const controller = new LedgerTransactionController();
      const data = await controller.deleteTransaction(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

}