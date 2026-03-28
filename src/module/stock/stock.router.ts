import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import StockController from "./stock.controller";
import { StockDelete, StockFetchBody } from "./stock.types";

export async function stockRouter(app: FastifyInstance) {

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


}