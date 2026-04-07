import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreatePartyBalanceBody,
  DeletePartyBalanceBody,
  FetchPartyBalanceBody,
  RepayPartyBalanceBody
} from "./partyBalance.types";

import PartyBalanceController from "./partyBalance.controller";

export async function partyBalanceRouter(app: FastifyInstance) {


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



  app.post<{ Body: RepayPartyBalanceBody }>(
    "/repay",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "ref_id",
            "ref_type",
            "firm_id",
            "pay_amount",
            "updated_by",
            "company_id",
          ],
          properties: {
            payment_amount: {
              type: "number"
            },
            ref_id: {
              type: "number"
            },
            company_id: {   // ✅ fixed
              type: "number"
            },
            firm_id: {
              type: "number"
            },
            pay_amount: {
              type: "number",
              minimum: 1   // ✅ added
            },
            updated_by: {
              type: "string"
            },
            ref_type: {
              type: "string",
              enum: ["P", "S"]   // ✅ added
            },
            transaction_reference: {
              type: "string"
            },
            payment_method_id: {
              type: ["number","null"]
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



}