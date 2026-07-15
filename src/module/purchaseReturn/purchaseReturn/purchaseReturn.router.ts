import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  PurchaseReturnCreateBody,
  PurchaseReturnDeleteBody,
  PurchaseReturnEditBody,
  PurchaseReturnFetchBody
} from "./purchaseReturn.types";
import PurchaseReturnController from "./purchaseReturn.controller";

export async function purchaseReturnRouter(app: FastifyInstance) {

  // CREATE PURCHASE
  app.post<{ Body: PurchaseReturnCreateBody }>(
    "/create",
    {
      "schema": {
        "body": {
          "type": "object",
          "required": [
            "purchase_id",
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
            "payments",
            "items"
          ],
          "properties": {
            "purchase_id": { "type": "number" },
            "return_date": { "type": ["string", "object"], "format": "date" },

            "firm_id": { "type": "number" },
            "branch_id": { "type": "number" },
            "company_id": { "type": "number" },

            "created_by": { "type": "string", "minLength": 1 },

            "subtotal": { "type": "number" },
            "net_amount": { "type": "number" },
            "total_cgst": { "type": "number" },
            "total_sgst": { "type": "number" },
            "total_igst": { "type": "number" },
            "final_amount": { "type": "number" },

            "reason": { "type": ["string", "null"] },

            "status": {
              "type": "string",
              "enum": ["Completed", "Confirm", "Cancelled"]
            },

            "payments": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["payment_method_id", "payment_amount"],
                "properties": {
                  "payment_method_id": { "type": "number" },
                  "payment_amount": { "type": "number", "minimum": 0 },
                  "reference": { "type": ["string", "null"] }
                }
              }
            },

            "items": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "object",
                "required": [
                  "product_id",
                  "returned_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "total_igst",
                  "total_sgst",
                  "total_cgst",
                  "net_amount",
                  "purchase_item_id"
                ],
                "properties": {
                  "product_id": { "type": "number" },
                  "purchase_item_id": { "type": "number" },
                  "stock_id": { "type": "number" },
                  "returned_qty": { "type": "number" },
                  "unit": { "type": "string" },
                  "unit_price": { "type": "number" },
                  "sub_total": { "type": "number" },
                  "total_igst": { "type": "number" },
                  "total_sgst": { "type": "number" },
                  "total_cgst": { "type": "number" },
                  "net_amount": { "type": "number" }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: PurchaseReturnCreateBody }>,
      reply: FastifyReply
    ) => {
      const controller = new PurchaseReturnController();

      const data = await controller.purchaseReturnCreate(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );

  // FETCH PURCHASE LIST
  app.post<{ Body: PurchaseReturnFetchBody }>(
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
      request: FastifyRequest<{ Body: PurchaseReturnFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new PurchaseReturnController();
      const data = await controller.purchaseReturnFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // FETCH FULL PURCHASE DETAILS
  app.post<{ Body: PurchaseReturnFetchBody }>(
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
      request: FastifyRequest<{ Body: PurchaseReturnFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new PurchaseReturnController();
      const data = await controller.fullPurchaseFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // EDIT PURCHASE
  app.post<{ Body: PurchaseReturnEditBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["purchase_return_id", "firm_id", "updated_by"],
          properties: {
            purchase_return_id: { type: "number" },
            purchase_id: { type: "number" }, // Associated original purchase if applicable
            company_id: { type: "number" },
            updated_by: { type: "string", minLength: 1 },
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            vendor_id: { type: "string" },
            return_number: { type: "string" },
            return_date: { type: "string", format: "date" },
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
            reason: { type: ["string", "null"] },
            status: {
              type: ["string", "null"],
              enum: ["Completed", "Confirm", "Cancelled", null]
            },
            payments: {
              type: "array",
              items: {
                type: "object",
                required: ["payment_method_id", "amount"],
                properties: {
                  id: { type: ["number", "null"] },
                  payment_method_id: { type: "number" },
                  amount: { type: "number", minimum: 0 },
                  transaction_reference: { type: ["string", "null"] },
                  payment_flow: {
                    "type": "string",
                    "enum": ["E", "I"]
                  }
                }
              }
            },
            items: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "product_id",
                  "returned_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "net_amount"
                ],
                properties: {
                  item_id: { type: "number" },
                  is_new: { type: "boolean" },
                  product_id: { type: "number" },
                  stock_id: { type: "number" },
                  returned_qty: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  sub_total: { type: "number" },
                  total_igst: { type: "number" },
                  total_sgst: { type: "number" },
                  total_cgst: { type: "number" },
                  net_amount: { type: "number" },
                  status: { type: "string" }
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
      request: FastifyRequest<{ Body: PurchaseReturnEditBody }>,
      reply: FastifyReply
    ) => {
      const controller = new PurchaseReturnController();
      const data = await controller.purchaseReturnEdit(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );
  app.post<{ Body: PurchaseReturnDeleteBody }>(
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
      request: FastifyRequest<{ Body: PurchaseReturnDeleteBody }>,
      reply: FastifyReply
    ) => {
      const controller = new PurchaseReturnController();
      const data = await controller.purchaseReturnDelete(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );
  // app.post<{ Body: PurchaseReturnEditBody }>(
  //   "/edit",
  //   {
  //     schema: {
  //       body: {
  //         type: "object",
  //         required: ["purchase_id", "firm_id", "updated_by"],
  //         properties: {
  //           purchase_id: { type: "number" },
  //           company_id: { type: "number" },
  //           updated_by: { type: "string", minLength: 1 },
  //           firm_id: { type: "number" },
  //           branch_id: { type: "number" },
  //           vendor_id: { type: "string" },
  //           bill_number: { type: "string" },
  //           bill_date: { type: "string", format: "date" },
  //           transaction_reference: { type: ["string", "null"] },
  //           subtotal: { type: "number" },
  //           discount: { type: "number" },
  //           net_amount: { type: "number" },
  //           total_cgst: { type: "number" },
  //           total_sgst: { type: "number" },
  //           total_igst: { type: "number" },
  //           final_amount: { type: "number" },
  //           payment_method_id: { type: "number" },
  //           payment_amount: { type: "number" },
  //           notes: { type: ["string", "null"] },
  //           status: {
  //             type: "string",
  //             enum: ["Completed", "Confirm", "Cancelled"]
  //           },
  //           items: {
  //             type: "array",
  //             items: {
  //               type: "object",
  //               required: [
  //                 "item_id",
  //                 "purchase_return_id",
  //                 "firm_id",
  //                 "branch_id",
  //                 "returned_qty",
  //                 "purchase_item_id"
  //               ],
  //               properties: {
  //                 item_id: { type: "number" },
  //                 purchase_return_id: { type: "number" },
  //                 firm_id: { type: "number" },
  //                 branch_id: { type: "number" },
  //                 status: { type: "string" },

  //                 product_id: { type: "number" },
  //                 stock_id: { type: "number" },

  //                 returned_qty: { type: "number" },
  //                 unit: { type: "string" },
  //                 unit_price: { type: "number" },

  //                 sub_total: { type: "number" },
  //                 total_igst: { type: "number" },
  //                 total_sgst: { type: "number" },
  //                 total_cgst: { type: "number" },
  //                 net_amount: { type: "number" },

  //                 purchase_item_id: { type: "number" }
  //               }
  //             }
  //           }
  //         }
  //       }
  //     }
  //   },
  //   async (
  //     request: FastifyRequest<{ Body: PurchaseReturnEditBody }>,
  //     reply: FastifyReply
  //   ) => {
  //     const controller = new PurchaseReturnController();
  //     const data = await controller.purchaseReturnEdit(request.body);

  //     return reply.code(200).send({
  //       status: "Success",
  //       message: data
  //     });
  //   }
  // );

}