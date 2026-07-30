import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AssetPurchaseCreateBody,
  AssetPurchaseEditBody,
  AssetPurchaseDeleteBody,
  AssetPurchaseFetchBody
} from "./assetPurchase.types";
import AssetPurchaseController from "./assetPurchase.controller";

export async function assetPurchaseRouter(app: FastifyInstance) {

  // CREATE ASSET PURCHASE
  app.post<{ Body: AssetPurchaseCreateBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
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
            "payments",
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
            subtotal: { type: "number" },
            discount: { type: "number" },
            net_amount: { type: "number" },
            total_cgst: { type: "number" },
            total_sgst: { type: "number" },
            total_igst: { type: "number" },
            courier_charge: { type: "number" },
            other_charge: { type: "number" },
            handling_charge: { type: "number" },
            final_amount: { type: "number" },
            notes: { type: ["string", "null"] },
            payments: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "payment_method_id",
                  "payment_amount"
                ],
                properties: {
                  payment_method_id: { type: "number" },
                  payment_amount: { type: "number" },
                  transaction_reference: { type: ["string", "null"] }
                }
              }
            },
            items: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "asset_product_id",
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
                  asset_product_id: { type: "number" },
                  received_qty: { type: "number" },
                  purchased_qty: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  sub_total: { type: "number" },
                  total_igst: { type: "number" },
                  total_sgst: { type: "number" },
                  total_cgst: { type: "number" },
                  net_amount: { type: "number" },
                  identification_number: { type: ["string", "null"] },
                  serial_number: { type: ["string", "null"] },
                  warranty_expiry: { type: ["string", "null"], format: "date" }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: AssetPurchaseCreateBody }>,
      reply: FastifyReply
    ) => {
      const controller = new AssetPurchaseController();
      const data = await controller.assetPurchaseCreate(request.body);
      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );

  // FETCH LIST SUMMARY
  app.post<{ Body: AssetPurchaseFetchBody }>(
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
      request: FastifyRequest<{ Body: AssetPurchaseFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new AssetPurchaseController();
      const data = await controller.assetPurchaseFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // FETCH FULL DETAILS
  app.post<{ Body: AssetPurchaseFetchBody }>(
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
      request: FastifyRequest<{ Body: AssetPurchaseFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new AssetPurchaseController();
      const data = await controller.fullAssetPurchaseFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // EDIT ASSET PURCHASE
  app.post<{ Body: AssetPurchaseEditBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["asset_purchase_id", "firm_id", "updated_by"],
          properties: {
            asset_purchase_id: { type: "number" },
            company_id: { type: "number" },
            updated_by: { type: "string", minLength: 1 },
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            vendor_id: { type: "string" },
            bill_number: { type: "string" },
            bill_date: { type: "string", format: "date" },
            subtotal: { type: "number" },
            discount: { type: "number" },
            net_amount: { type: "number" },
            total_cgst: { type: "number" },
            total_sgst: { type: "number" },
            total_igst: { type: "number" },
            courier_charge: { type: "number" },
            other_charge: { type: "number" },
            handling_charge: { type: "number" },
            final_amount: { type: "number" },
            notes: { type: ["string", "null"] },
            status: {
              type: ["string", "null"],
              enum: ["Completed", "Confirm", "Cancelled", null]
            },
            payments: {
              type: "array",
              items: {
                type: "object",
                required: ["payment_method_id", "amount", "payment_flow"],
                properties: {
                  id: { type: ["number", "null"] },
                  payment_method_id: { type: "number" },
                  amount: { type: "number", minimum: 0 },
                  transaction_reference: { type: ["string", "null"] },
                  payment_flow: {
                    type: "string",
                    enum: ["E", "I"]
                  }
                }
              }
            },
            items: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "asset_product_id",
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
                  asset_stock_id: { type: "number" },
                  is_new: { type: "boolean" },
                  status: {
                    type: "string",
                    enum: ["Completed", "Confirm", "Cancelled"]
                  },
                  asset_product_id: { type: "number" },
                  received_qty: { type: "number" },
                  purchased_qty: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  sub_total: { type: "number" },
                  total_igst: { type: "number" },
                  total_sgst: { type: "number" },
                  total_cgst: { type: "number" },
                  net_amount: { type: "number" },
                  identification_number: { type: ["string", "null"] },
                  serial_number: { type: ["string", "null"] },
                  warranty_expiry: { type: ["string", "null"], format: "date" }
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
      request: FastifyRequest<{ Body: AssetPurchaseEditBody }>,
      reply: FastifyReply
    ) => {
      const controller = new AssetPurchaseController();
      const data = await controller.assetPurchaseEdit(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

  // DELETE ASSET PURCHASE
  app.post<{ Body: AssetPurchaseDeleteBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "company_id", "deleted_by"],
          properties: {
            id: { type: "number" },
            company_id: { type: "number" },
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            deleted_by: { type: "string", minLength: 1 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: AssetPurchaseDeleteBody }>,
      reply: FastifyReply
    ) => {
      const controller = new AssetPurchaseController();
      const data = await controller.assetPurchaseDelete(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

}