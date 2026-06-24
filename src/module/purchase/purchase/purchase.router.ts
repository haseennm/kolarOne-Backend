import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  PurchaseCreateBody,
  PurchaseEditBody,
  PurchaseDeleteBody,
  PurchaseFetchBody
} from "./purchase.types";
import PurchaseController from "./purchase.controller";

export async function purchaseRouter(app: FastifyInstance) {

  app.post<{ Body: PurchaseCreateBody }>(
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
            "vendor_id",
            "bill_number",
            "bill_date",
            "subtotal",
            "discount",
            "net_amount",
            "total_cgst",
            "total_sgst",
            "total_igst",
            "final_amount",
            "payment_method_id",
            "payment_amount",
            "items"
          ],
          properties: {
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            company_id: { type: "number" },
            created_by: { type: "string", minLength: 1 },
            vendor_id: { type: "string" },
            bill_number: { type: "string" },
            bill_date: { type: "string", format: "date" },
            transaction_reference: { type: ["string", "null"] },
            subtotal: { type: "number" },
            discount: { type: "number" },
            net_amount: { type: "number" },
            total_cgst: { type: "number" },
            total_sgst: { type: "number" },
            total_igst: { type: "number" },
            final_amount: { type: "number" },
            payment_method_id: { type: "number" },
            payment_amount: { type: "number" },
            notes: { type: ["string", "null"] },
            status: {
              type: "string",
              enum: ["Completed", "Confirm", "Cancelled"]
            },
            items: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "product_id",
                  "received_qty",
                  "purchased_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "total_igst",
                  "total_sgst",
                  "total_cgst",
                  "net_amount"
                ],
                properties: {
                  product_id: { type: "number" },
                  received_qty: { type: "number" },
                  purchased_qty: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  sub_total: { type: "number" },
                  total_igst: { type: "number" },
                  total_sgst: { type: "number" },
                  total_cgst: { type: "number" },
                  net_amount: { type: "number" }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: PurchaseCreateBody }>,
      reply: FastifyReply
    ) => {
      const controller = new PurchaseController();
      const data = await controller.purchaseCreate(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );

  app.post<{ Body: PurchaseFetchBody }>(
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
      request: FastifyRequest<{ Body: PurchaseFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new PurchaseController();
      const data = await controller.purchaseFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  app.post<{ Body: PurchaseFetchBody }>(
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
      request: FastifyRequest<{ Body: PurchaseFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new PurchaseController();
      const data = await controller.fullPurchaseFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  app.post<{ Body: PurchaseEditBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["purchase_id", "firm_id", "updated_by"],
          properties: {
            purchase_id: { type: "number" },
            company_id: { type: "number" },
            updated_by: { type: "string", minLength: 1 },
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            vendor_id: { type: "string" },
            bill_number: { type: "string" },
            bill_date: { type: "string", format: "date" },
            transaction_reference: { type: ["string", "null"] },
            subtotal: { type: "number" },
            discount: { type: "number" },
            net_amount: { type: "number" },
            total_cgst: { type: "number" },
            total_sgst: { type: "number" },
            total_igst: { type: "number" },
            final_amount: { type: "number" },
            payment_method_id: { type: "number" },
            payment_amount: { type: "number" },
            notes: { type: ["string", "null"] },
            status: {
              type: ["string", "null"],
              enum: ["Completed", "Confirm", "Cancelled", null]
            },
            items: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "product_id",
                  "received_qty",
                  "purchased_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "total_igst",
                  "total_sgst",
                  "total_cgst",
                  "net_amount"
                ],
                properties: {
                  item_id: { type: "number" },
                  is_new: { type: "boolean" },
                  batches: { type: "array" },
                  status: {
                    type: "string",
                    enum: ["Completed", "Confirm", "Cancelled"]
                  },
                  product_id: { type: "number" },
                  received_qty: { type: "number" },
                  purchased_qty: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  sub_total: { type: "number" },
                  total_igst: { type: "number" },
                  total_sgst: { type: "number" },
                  total_cgst: { type: "number" },
                  net_amount: { type: "number" }
                }
              }
            },
            delete_item_ids: {
              type: "array",
              items: { type: "number" }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: PurchaseEditBody }>,
      reply: FastifyReply
    ) => {
      const controller = new PurchaseController();
      const data = await controller.purchaseEdit(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

  app.post<{ Body: PurchaseDeleteBody }>(
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
      request: FastifyRequest<{ Body: PurchaseDeleteBody }>,
      reply: FastifyReply
    ) => {
      const controller = new PurchaseController();
      const data = await controller.purchaseDelete(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

}
