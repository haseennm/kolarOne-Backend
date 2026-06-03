import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { cns } from "../../utils/extra";

import { CreateStockRentBody, DeleteStockRentBody, EditStockRentBody, FetchStockRentBody } from "./stockRent.types";
import StockRentalController from "./stockRent.controller";

export async function stockRentalRouter(app: FastifyInstance): Promise<void> {

  app.post<{ Body: CreateStockRentBody }>(
    "/add",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "company_id",
            "branch_id",
            "product_id",
            "is_group_item",
            "total_units",
            "unique_name",
            "price_hour",
            "price_day",
            "price_week",
            "price_month",
            "default_return_date",
            "created_by"
          ],
          properties: {
            company_id: {
              type: "number"
            },
            branch_id: {
              type: "number"
            },
            product_id: {
              type: "number"
            },
            is_group_item: {
              type: "boolean"
            },
            total_units: {
              type: "number",
              minimum: 0
            },
            unique_name: {
              type: "array",
              items: {
                type: "string",
                minLength: 1
              }
            },
            price_hour: {
              type: "number",
              minimum: 0
            },
            price_day: {
              type: "number",
              minimum: 0
            },
            price_week: {
              type: "number",
              minimum: 0
            },
            price_month: {
              type: "number",
              minimum: 0
            },
            default_return_date: {
              type: "number",
              minimum: 1
            },
            created_by: {
              anyOf: [
                { type: "string" },
                { type: "number" }
              ]
            },
            status: {
              type: "string",
              enum: ["Active", "Inactive", "Good", "Damaged"]
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateStockRentBody }>,
      reply: FastifyReply
    ) => {

      cns(request.url, request.body);

      const controller = new StockRentalController();

      const customer = await controller.createStockRental(request.body);

      return reply.code(201).send({
        status: "Success",
        message: customer,
      });
    }
  );

  app.post<{ Body: FetchStockRentBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1 },
            id: { type: "string" },
            company_id: { type: "number" },
            customer_type: { type: "string" },
            search: { type: ["string", "null"] },
            status: { type: "number" }
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: FetchStockRentBody }>,
      reply: FastifyReply
    ) => {

      cns(request.url, request.body);

      const { page = 1, limit = 10, ...filters } = request.body;
      const offset = (page - 1) * limit;

      const controller = new StockRentalController();

      const customers = await controller.fetchStockRental({
        offset,
        filters: {
          ...filters,
          page,
          limit,
        },
      });

      return reply.code(200).send(customers);
    }
  );

  app.post<{ Body: EditStockRentBody }>(
    "/edit",
      {
      schema: {
        body: {
          type: "object",
          required: [
            "company_id",
            "branch_id",
            "id",
            "updated_by"
          ],
          properties: {
            id: {
              type: "number"
            },
            company_id: {
              type: "number"
            },
            branch_id: {
              type: "number"
            },
            product_id: {
              type: "number"
            },
            total_units: {
              type: "number",
              minimum: 0
            },
            unique_name: {
              type: "array",
              items: {
                type: "string",
                minLength: 1
              }
            },
            price_hour: {
              type: "number",
              minimum: 0
            },
            price_day: {
              type: "number",
              minimum: 0
            },
            price_week: {
              type: "number",
              minimum: 0
            },
            price_month: {
              type: "number",
              minimum: 0
            },
            default_return_date: {
              type: "number",
              minimum: 1
            },
            updated_by: {
              anyOf: [
                { type: "string" },
                { type: "number" }
              ]
            },
            status: {
              type: "string",
              enum: ["Active", "Inactive", "Good", "Damaged"]
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EditStockRentBody }>,
      reply: FastifyReply
    ) => {
      cns(request.url, request.body);
      const controller = new StockRentalController();
      const customer = await controller.editStockRental(request.body);
      return reply.code(200).send({
        status: "Success",
        message: customer,
      });
    }
  );

  app.post<{ Body: DeleteStockRentBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "deleted_by", "branch_id"],
          properties: {
            r_id: { type: "string" },
            branch_id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: DeleteStockRentBody }>,
      reply: FastifyReply
    ) => {

      cns(request.url, request.body);

      const controller = new StockRentalController();

      const customer = await controller.deleteStockRental(request.body);

      return reply.code(200).send({
        status: "Success",
        message: customer,
      });
    }
  );
  //   app.post<{ Body: GetCustomerReport }>(
  //   "/reports",
  //   {
  //     schema: {
  //       body: {
  //         type: "object",
  //         required: ["level"],
  //         properties: {
  //           level: {
  //             type: "string",
  //             enum: ["firm", "branch", "company"]
  //           },
  //           firm_id: { type: ["number", "null"] },
  //           branch_id: { type: ["number", "null"] },
  //           company_id: { type: ["number", "null"] },
  //           start_date: { type: ["string", "null"] },
  //           end_date: { type: ["string", "null"] }
  //         }
  //       }
  //     }
  //   },
  //   async (request, reply) => {

  //     const controller = new StockRentalController();

  //     const data = await controller.getCustomerReport(request.body);

  //     return reply.send({
  //       status: "Success",
  //       data
  //     });
  //   }
  // );
}