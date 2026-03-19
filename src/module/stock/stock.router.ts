import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import StockController from "./stock.controller";
import { StockDelete, StockFetchBody } from "./stock.types";

export async function roleRouter(app: FastifyInstance) {

  // CREATE ROLE
  // app.post<{ Body: CreateRoleBody }>(
  //   "/create",
  //   {
  //     schema: {
  //       body: {
  //         type: "object",
  //         required: ["role", "company_id", "status"],
  //         properties: {

  //           role: {
  //             type: "string",
  //             minLength: 1,
  //             maxLength: 100
  //           },

  //           description: {
  //             type: "string",
  //             maxLength: 300

  //           },

  //           company_id: {
  //             type: "number"
  //           },

  //           status: {
  //             type: "string",
  //             enum: ["Active", "Inactive"]
  //           }

  //         }
  //       }
  //     }
  //   },
  //   async (
  //     request: FastifyRequest<{ Body: CreateRoleBody }>,
  //     reply: FastifyReply
  //   ) => {

  //     const controller = new StockController();
  //     const data = await controller.createRole(request.body);

  //     return reply.code(201).send({
  //       status: "Success",
  //       message: data
  //     });

  //   }
  // );

  // FETCH ROLE
  app.post<{ Body: StockFetchBody }>(
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

          status: { type: "number" },

          search: { type: "string" },

          // ✅ Quantity filters
          available_qty_min: { type: "number" },
          available_qty_max: { type: "number" },
          purchased_qty_min: { type: "number" },
          purchased_qty_max: { type: "number" },

          // ✅ Sorting
          sort_by: { type: "string" },
          sort_order: { type: "string", enum: ["asc", "desc"] },

          // ✅ Pagination
          page: {
            type: "number",
            minimum: 1,
            default: 1
          },
          limit: {
            type: "number",
            minimum: 1,
            default: 10
          }
        }
      }
    }
  },
  async (
    request: FastifyRequest<{ Body: StockFetchBody }>,
    reply: FastifyReply
  ) => {

    const { page = 1, limit = 10, ...filters } = request.body;

    const controller = new StockController(); // ✅ changed

    const data = await controller.fetchStock({   // ✅ changed
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

  // EDIT ROLE
  // app.post<{ Body: EditRoleBody }>(
  //   "/edit",
  //   {
  //     schema: {
  //       body: {
  //         type: "object",
  //         required: ["id", "company_id"],
  //         properties: {

  //           id: {
  //             type: "number"
  //           },

  //           company_id: {
  //             type: "number"
  //           },

  //           role: {
  //             type: "string"
  //           },

  //           description: {
  //             type: "string"
  //           },

  //           status: {
  //             type: "string",
  //             enum: ["Active", "Inactive"]
  //           }

  //         }
  //       }
  //     }
  //   },
  //   async (
  //     request: FastifyRequest<{ Body: EditRoleBody }>,
  //     reply: FastifyReply
  //   ) => {

  //     const controller = new StockController();
  //     const data = await controller.editRole(request.body);

  //     return reply.code(200).send({
  //       status: "Success",
  //       message: data
  //     });

  //   }
  // );

  // DELETE ROLE
  // app.post<{ Body: StockDelete }>(
  //   "/delete",
  //   {
  //     schema: {
  //       body: {
  //         type: "object",
  //         required: ["id", "branch_id"],
  //         properties: {

  //           id: {
  //             type: "number"
  //           },

  //           branch_id: {
  //             type: "number"
  //           }

  //         }
  //       }
  //     }
  //   },
  //   async (
  //     request: FastifyRequest<{ Body: StockDelete }>,
  //     reply: FastifyReply
  //   ) => {

  //     const controller = new StockController();
  //     const data = await controller.deleteRole(request.body);

  //     return reply.code(200).send({
  //       status: "Success",
  //       message: data
  //     });

  //   }
  // );

}