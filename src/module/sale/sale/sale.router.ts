import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  SaleCreateBody,
  SaleEditBody,
  SaleDeleteBody,
  SaleFetchBody
} from "./sale.types";
import SaleController from "./sale.controller";

export async function purchaseRouter(app: FastifyInstance) {

  app.post<{ Body: SaleCreateBody }>(
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
            "paid",
            "payments",
            "items"
          ],
          properties: {
            firm_id: { type: "number" },
            branch_id: { type: "number" },
            company_id: { type: "number" },
            created_by: { type: "string", minLength: 1 },

            customer_id: { type: "string" },
            invoice_date: { type: "string", format: "date" },

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
              minItems: 1,
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
              minItems: 1,
              items: {
                type: "object",
                required: [
                  "product_id",
                  "stock_id",
                  "saled_qty",
                  "unit",
                  "unit_price",
                  "sub_total",
                  "net_amount"
                ],
                properties: {
                  product_id: { type: "number" },
                  stock_id: { type: "number" },
                  saled_qty: { type: "number" },

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
      request: FastifyRequest<{ Body: SaleCreateBody }>,
      reply: FastifyReply
    ) => {
      const controller = new SaleController();
      const data = await controller.saleCreate(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );

  // FETCH PURCHASE LIST
  app.post<{ Body: SaleFetchBody }>(
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
      request: FastifyRequest<{ Body: SaleFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new SaleController();
      const data = await controller.saleFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // FETCH FULL PURCHASE DETAILS
  app.post<{ Body: SaleFetchBody }>(
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
      request: FastifyRequest<{ Body: SaleFetchBody }>,
      reply: FastifyReply
    ) => {
      const { page = 1, limit = 10, ...filters } = request.body;
      const controller = new SaleController();
      const data = await controller.fullsaleFetch({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.code(200).send(data);
    }
  );

  // EDIT PURCHASE
  // app.post<{ Body: PurchaseEditBody }>(
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
  //                 "product_id",
  //                 "received_qty",
  //                 "purchased_qty",
  //                 "unit",
  //                 "unit_price",
  //                 "sub_total",
  //                 "total_igst",
  //                 "total_sgst",
  //                 "total_cgst",
  //                 "net_amount"
  //               ],
  //               properties: {
  //                 item_id: { type: "number" },
  //                 product_id: { type: "number" },
  //                 received_qty: { type: "number" },
  //                 purchased_qty: { type: "number" },
  //                 unit: { type: "string" },
  //                 unit_price: { type: "number" },
  //                 sub_total: { type: "number" },
  //                 total_igst: { type: "number" },
  //                 total_sgst: { type: "number" },
  //                 total_cgst: { type: "number" },
  //                 net_amount: { type: "number" }
  //               }
  //             }
  //           }
  //         }
  //       }
  //     }
  //   },
  //   async (
  //     request: FastifyRequest<{ Body: PurchaseEditBody }>,
  //     reply: FastifyReply
  //   ) => {
  //     const controller = new PurchaseController();
  //     const data = await controller.purchaseEdit(request.body);

  //     return reply.code(200).send({
  //       status: "Success",
  //       message: data
  //     });
  //   }
  // );

  // DELETE PURCHASE
  app.post<{ Body: SaleDeleteBody }>(
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
      request: FastifyRequest<{ Body: SaleDeleteBody }>,
      reply: FastifyReply
    ) => {
      const controller = new SaleController();
      const data = await controller.saleDelete(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

}