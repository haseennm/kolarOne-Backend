import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import PaymentMethodController from "./paymentMethod.controller";

import {
  CreatePaymentMethodBody,
  FetchPaymentMethodBody,
  EditPaymentMethodBody,
  DeletePaymentMethodBody
} from "./paymentMethod.types";

export async function paymentMethodRouter(app: FastifyInstance) {

  
  app.post<{ Body: CreatePaymentMethodBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "company_id", "created_by"],
          properties: {

            name: {
              type: "string",
              minLength: 2,
              maxLength: 150
            },

            company_id: {
              type: "number"
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"]
            },

            created_by: {
              type: "string"
            },

            note: {
              type: ["string", "null"]
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: CreatePaymentMethodBody }>, reply: FastifyReply) => {

      const controller = new PaymentMethodController();
      const data = await controller.createPaymentMethod(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });

    }
  );


  
  app.post<{ Body: FetchPaymentMethodBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id"],
          properties: {

            page: {
              type: "number",
              minimum: 1
            },

            limit: {
              type: "number",
              minimum: 1
            },

            id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },

            search: {
              type: ["string", "null"]
            },

            status: {
              type: "number",
              enum: [0, 1, 2]
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: FetchPaymentMethodBody }>, reply: FastifyReply) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new PaymentMethodController();

      const data = await controller.fetchPaymentMethod({
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


  
  app.post<{ Body: EditPaymentMethodBody }>(
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

            name: {
              type: "string",
              minLength: 2,
              maxLength: 150
            },

            note: {
              type: ["string", "null"]
            },

            status: {
              type: "string",
              enum: ["Active", "Inactive"]
            },

            updated_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: EditPaymentMethodBody }>, reply: FastifyReply) => {

      const controller = new PaymentMethodController();
      const data = await controller.editPaymentMethod(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );


  
  app.post<{ Body: DeletePaymentMethodBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "company_id", "deleted_by"],
          properties: {

            r_id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },

            deleted_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: DeletePaymentMethodBody }>, reply: FastifyReply) => {

      const controller = new PaymentMethodController();
      const data = await controller.deletePaymentMethod(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

}