import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  QuotationCreateBody,
  QuotationEditBody,
  QuotationDeleteBody,
  QuotationFetchBody
} from "./quotation.types";
import QuotationController from "./quotation.controller";

export async function quotationRouter(app: FastifyInstance) {

  app.post<{ Body: QuotationCreateBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "firm_id",
            "branch_id",
            "company_id",
            "created_by",
            "customer_id",
            "invoice_date",
            "subtotal",
            "discount",
            "net_amount",
            "total_cgst",
            "total_sgst",
            "total_igst",
            "final_amount",
            "items",
            "price_pool",
            "is_intrastate",
            "state_code"
          ],
          properties: {
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            company_id: { type: "number" },
            created_by: { type: "string", minLength: 1 },

            customer_id: { type: "string", format: "uuid" },
            invoice_date: { type: "string", format: "date" },

            subtotal: { type: "number" },
            discount: { type: "number" },
            net_amount: { type: "number" },

            total_cgst: { type: "number" },
            total_sgst: { type: "number" },
            total_igst: { type: "number" },

            final_amount: { type: "number" },
            state_code: { type: "number" },
            is_intrastate: { type: "boolean" },

            notes: { type: ["string", "null"] },

            status: {
              type: "string",
              enum: ["Completed", "Confirm", "Cancelled"]
            },
            price_pool: {
              type: "string",
              enum: [ 'branch_price', 'mrp_price', 'retail_price', 'special_retail_price', 'wholesale_price']
            },

  

            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: [
                  "product_id",
                  "stock_id",
                  "quotation_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "net_amount"
                ],
                properties: {
                  product_id: { type: "number" },
                  stock_id: { type: "number" },
                  quotation_qty: { type: "number" },

                  unit: { type: "string" },
                  unit_price: { type: "number" },

                  sub_total: { type: "number" },
                  discount: { type: "number", default: 0 },

                  total_igst: { type: "number", default: 0 },
                  total_sgst: { type: "number", default: 0 },
                  total_cgst: { type: "number", default: 0 },

                  net_amount: { type: "number" },
                  final_amount: { type: ["number", "null"] }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: QuotationCreateBody }>,
      reply: FastifyReply
    ) => {
      const controller = new QuotationController();
      const data = await controller.QuotationCreate(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );

  // FETCH PURCHASE LIST
  app.post<{ Body: QuotationFetchBody }>(
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
      request: FastifyRequest<{ Body: QuotationFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new QuotationController();
      const data = await controller.QuotationFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // FETCH FULL PURCHASE DETAILS
  app.post<{ Body: QuotationFetchBody }>(
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
      request: FastifyRequest<{ Body: QuotationFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new QuotationController();
      const data = await controller.fullQuotationFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // EDIT SALE
  app.post<{ Body: QuotationEditBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["Sale_id", "firm_id", "branch_id", "company_id", "updated_by"],
          properties: {
            Sale_id: { type: "number" },
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            company_id: { type: "number" },
            updated_by: { type: "string", minLength: 1 },
            customer_id: { type: ["string", "null"], format: "uuid" },
            invoice_date: { type: ["string", "null"], format: "date" },
            subtotal: { type: "number" },
            discount: { type: "number" },
            net_amount: { type: "number" },
            total_cgst: { type: "number" },
            total_sgst: { type: "number" },
            total_igst: { type: "number" },
            final_amount: { type: "number" },
            paid: { type: "number" },
            notes: { type: ["string", "null"] },
            status: {
              type: "string",
              enum: ["Completed", "Confirm", "Cancelled"]
            },
            payments: {
              type: "array",
              items: {
                type: "object",
                required: ["amount"],
                properties: {
                  payment_method_id: { type: ["number", "null"] },
                  amount: { type: "number" },
                  reference: { type: ["string", "null"] }
                }
              }
            },
            items: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "item_id",
                  "product_id",
                  "stock_id",
                  "quotation_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "net_amount"
                ],
                properties: {
                  item_id: { type: "number" },
                  product_id: { type: "number" },
                  stock_id: { type: "number" },
                  quotation_qty: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  sub_total: { type: "number" },
                  discount: { type: "number" },
                  total_igst: { type: "number" },
                  total_sgst: { type: "number" },
                  total_cgst: { type: "number" },
                  net_amount: { type: "number" },
                  final_amount: { type: ["number", "null"] }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: QuotationEditBody }>,
      reply: FastifyReply
    ) => {
      const controller = new QuotationController();
      const data = await controller.quotationEdit(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

  // DELETE SALE
  app.post<{ Body: QuotationDeleteBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "firm_id", "deleted_by", "branch_id"],
          properties: {
            id: { type: "number" },
            branch_id: { type: "number" },
            firm_id: { type: "number" },
            deleted_by: { type: "string", minLength: 1 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: QuotationDeleteBody }>,
      reply: FastifyReply
    ) => {
      const controller = new QuotationController();
      const data = await controller.QuotationDelete(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

}