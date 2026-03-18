import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreatePartyBalanceBody,
  DeletePartyBalanceBody,
  FetchPartyBalanceBody,
  RepayPartyBalanceBody
} from "./partyBalance.types";

import PartyBalanceController from "./partyBalance.controller";

export async function partyBalanceRouter(app: FastifyInstance) {

  // // CREATE PARTY BALANCE
  // app.post<{ Body: CreatePartyBalanceBody }>(
  //   "/create",
  //   {
  //     schema: {
  //       body: {
  //         type: "object",
  //         required: ["ref_id", "ref_type", "balance", "flow", "firm_id", "created_by"],
  //         properties: {

  //           ref_id: {
  //             type: "number"
  //           },

  //           ref_type: {
  //             type: "string",
  //             enum: ["S", "P", "SR", "PR"]
  //           },

  //           balance: {
  //             type: "number"
  //           },

  //           flow: {
  //             type: "string",
  //             enum: ["I", "O"]
  //           },

  //           firm_id: {
  //             type: "number"
  //           },

  //           created_by: {
  //             type: "string"
  //           }

  //         }
  //       }
  //     }
  //   },
  //   async (
  //     request: FastifyRequest<{ Body: CreatePartyBalanceBody }>,
  //     reply: FastifyReply
  //   ) => {

  //     const controller = new PartyBalanceController();
  //     const data = await controller.createPartyBalance(request.body);

  //     return reply.code(201).send({
  //       status: "Success",
  //       message: data
  //     });

  //   }
  // );



  // FETCH PARTY BALANCE
  app.post<{ Body: FetchPartyBalanceBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id", "page", "limit"],
          properties: {

            id: { type: "number" },

            firm_id: { type: "number" },

            balance_amount_min: { type: "number" },

            balance_amount_max: { type: "number" },

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
      request: FastifyRequest<{ Body: FetchPartyBalanceBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new PartyBalanceController();

      const data = await controller.fetchPartyBalance({
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



  // REPAY PARTY BALANCE
  app.post<{ Body: RepayPartyBalanceBody }>(
    "/repay",
    {
      schema: {
        body: {
          type: "object",
          required: ["PartyBalance_id", "firm_id", "pay_amount", "updated_by"],
          properties: {

            PartyBalance_id: {
              type: "number"
            },

            firm_id: {
              type: "number"
            },

            pay_amount: {
              type: "number"
            },

            updated_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: RepayPartyBalanceBody }>,
      reply: FastifyReply
    ) => {

      const controller = new PartyBalanceController();

      const data = await controller.rePayPartyBalance(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );



  // DELETE PARTY BALANCE
  app.post<{ Body: DeletePartyBalanceBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "delete_by", "firm_id"],
          properties: {

            id: {
              type: "number"
            },

            delete_by: {
              type: "string"
            },

            firm_id: {
              type: "number"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: DeletePartyBalanceBody }>,
      reply: FastifyReply
    ) => {

      const controller = new PartyBalanceController();

      const data = await controller.deletePartyBalance(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

}