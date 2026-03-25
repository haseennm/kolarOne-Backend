import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  SaleReturnCreateBody,
  SaleReturnDeleteBody,
  SaleReturnFetchBody
} from "./saleReturn.types";
import SaleReturnController from "./saleReturn.controller";

export async function saleReturnRouter(app: FastifyInstance) {

  app.post<{ Body: SaleReturnCreateBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "sale_id",
            "return_date",
            "firm_id",
            "branch_id",
            "company_id",
            "created_by",
            "subtotal",
            "net_amount",
            "total_cgst",
            "total_sgst",
            "total_igst",
            "final_amount",
            "payment_amount",
            "payment_method_id",
            "items"
          ],
          properties: {
            sale_id: { type: "number" },
            return_date: { type: ["string", "object"], format: "date" },
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            company_id: { type: "number" },
            created_by: { type: "string", minLength: 1 },
            subtotal: { type: "number" },
            net_amount: { type: "number" },
            total_cgst: { type: "number" },
            total_sgst: { type: "number" },
            total_igst: { type: "number" },
            final_amount: { type: "number" },
            payment_amount: { type: "number" },
            reason: { type: ["string", "null"] },
            transaction_reference: { type: ["string", "null"] },
            payment_method_id: { type: "number" },
            status: {
              type: "string",
              enum: ["Completed", "Confirm", "Cancelled"]
            },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: [
                  "product_id",
                  "returned_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "total_igst",
                  "total_sgst",
                  "total_cgst",
                  "net_amount",
                  "sale_item_id"
                ],
                properties: {
                  product_id: { type: "number" },
                  sale_item_id: { type: "number" },
                  stock_id: { type: "number" },
                  returned_qty: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  sub_total: { type: "number" },
                  total_igst: { type: "number" },
                  total_sgst: { type: "number" },
                  total_cgst: { type: "number" },
                  net_amount: { type: "number" },
                  return_mode: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: SaleReturnCreateBody }>,
      reply: FastifyReply
    ) => {
      const controller = new SaleReturnController();
      const data = await controller.saleReturnCreate(request.body);
      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );

  app.post<{ Body: SaleReturnFetchBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id"],
          properties: {
            id: { type: "number" },
            company_id: { type: "number" },
            branch_id: { type: "number" },
            firm_id: { type: "number" },
            search: { type: "string" },
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, default: 10 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: SaleReturnFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new SaleReturnController();
      const data = await controller.saleReturnFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });
      return reply.code(200).send(data);
    }
  );

  app.post<{ Body: SaleReturnFetchBody }>(
    "/get/details",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id", "id"],
          properties: {
            id: { type: "number" },
            company_id: { type: "number" },
            branch_id: { type: "number" },
            firm_id: { type: "number" },
            search: { type: "string" },
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, default: 10 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: SaleReturnFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new SaleReturnController();
      const data = await controller.fullSaleFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });
      return reply.code(200).send(data);
    }
  );

  app.post<{ Body: SaleReturnDeleteBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "firm_id", "deleted_by"],
          properties: {
            id: { type: "number" },
            firm_id: { type: "number" },
            deleted_by: { type: "string", minLength: 1 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: SaleReturnDeleteBody }>,
      reply: FastifyReply
    ) => {
      const controller = new SaleReturnController();
      const data = await controller.saleReturnDelete(request.body);
      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );
}