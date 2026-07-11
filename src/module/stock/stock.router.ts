import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import StockController from "./stock.controller";
import { FetchPopup, StockAdditionalBody, StockAdjustFetchBody, StockDelete, StockFetchBody, StockPriceSet, StockQtyChangeBody, StockReport } from "./stock.types";

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
            product_id: { type: "number" },

            status: { type: "number" },

            search: { type: "string" },
            barcode: { type: "string" },

            available_qty_min: { type: "number" },
            available_qty_max: { type: "number" },
            purchased_qty_min: { type: "number" },
            purchased_qty_max: { type: "number" },
            sort_by: { type: "string" },
            sort_order: { type: "string", enum: ["asc", "desc"] },

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
  app.post<{ Body: FetchPopup }>(
    "/get/popup",
    {
      schema: {
        body: {
          type: "object",
          required: ["branch_id", "stock_id", "product_id"],
          properties: {
            branch_id: { type: "number" },
            stock_id: { type: "number" },
            product_id: { type: "number" }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: FetchPopup }>,
      reply: FastifyReply
    ) => {
      const controller = new StockController();
      const data = await controller.fetchPopupStock(request.body);
      return reply.code(200).send(data);
    }
  );
  app.post<{ Body: StockAdjustFetchBody }>(
    "/adjustment/history",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id", "branch_id"],
          properties: {
            id: { type: "number" },

            company_id: { type: "number" },
            branch_id: { type: "number" },
            firm_id: { type: "number" },
            product_id: { type: "number" },

            status: { type: "number" },

            search: { type: "string" },
            flow_type: { type: "string", enum: ["Stock payment", "Stock receipt"] },

            quantity: { type: "number" },
            sort_by: { type: "string" },
            sort_order: { type: "string", enum: ["asc", "desc"] },

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
      request: FastifyRequest<{ Body: StockAdjustFetchBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new StockController(); // ✅ changed

      const data = await controller.fetchStockAdjust({   // ✅ changed
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
  app.post<{ Body: StockReport }>(
    "/reports",
    {
      schema: {
        body: {
          type: "object",
          required: ["level"],
          properties: {
            level: {
              type: "string",
              enum: ["firm", "branch", "company"]
            },

            firm_id: {
              type: ["number", "null"]
            },

            branch_id: {
              type: ["number", "null"]
            },

            company_id: {
              type: ["number", "null"]
            },


          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: StockReport }>,
      reply: FastifyReply
    ) => {
      const controller = new StockController();

      const report = await controller.reportStock(request.body);

      return reply.code(200).send({
        status: "Success",
        data: report
      });
    }
  );
  app.post<{ Body: StockAdditionalBody }>(
    "/manual",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id", "qty", "product_id", "branch_id", "firm_id"],
          properties: {
            company_id: { type: "number" },
            qty: { type: "number" },
            product_id: { type: "number" },
            branch_id: { type: "number" },

            firm_id: { type: ["number"] },
            insert_batch_number: { type: ["number", "null"] }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: StockAdditionalBody }>,
      reply: FastifyReply
    ) => {
      const controller = new StockController();

      const stock = await controller.manualStock(request.body);

      return reply.code(201).send({
        status: "Success",
        message: stock
      });
    }
  );
  app.post<{ Body: StockPriceSet }>(
    "/edit/price",
    {
      schema: {
        body: {
          type: "object",
          required: ["firm_id", "r_id", "mrp_price", "retail_price", "wholesale_price", "branch_price", "special_retail_price"],
          properties: {
            r_id: { type: "number" },
            special_retail_price: { type: "number" },
            branch_price: { type: "number" },
            wholesale_price: { type: "number" },
            retail_price: { type: "number" },
            firm_id: { type: "number" },
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: StockPriceSet }>,
      reply: FastifyReply
    ) => {
      const controller = new StockController();

      const stock = await controller.setPrice(request.body);

      return reply.code(201).send({
        status: "Success",
        message: stock
      });
    }
  );
  app.post<{ Body: StockQtyChangeBody }>(
    "/edit/available_qty",
    {
      schema: {
        body: {
          type: "object",
          required: ["branch_id", "company_id", "r_id", "available_qty", "note"],
          properties: {
            r_id: { type: "number" },
            available_qty: { type: "number" },
            company_id: { type: "number" },
            branch_id: { type: "number" },
            note: { type: "string" },
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: StockQtyChangeBody }>,
      reply: FastifyReply
    ) => {
      const controller = new StockController();

      const stock = await controller.changeQty(request.body);

      return reply.code(201).send({
        status: "Success",
        message: stock
      });
    }
  );

}