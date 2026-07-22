import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { JournalDetailed, JournalFetchBody } from "./journal.types";
import { JournalController } from "./journal.controller";


export async function journalRouter(app: FastifyInstance) {
app.post<{ Body: JournalFetchBody }>(
  "/get",
  {
    schema: {
      body: {
        type: "object",
        required: [
          "entity_id",
          "entity_type",
          "company_id",
          "page",
          "limit"
        ],
        properties: {
          entity_id: {
            type: "number"
          },
          entity_type: {
            type: "string",
            enum: ["C", "B", "F"]
          },
          company_id: {
            type: "number"
          },
          page: {
            type: "number",
            minimum: 1
          },

          limit: {
            type: "number",
            minimum: 1
          }
        }
      }
    }
  },
  async (
    request: FastifyRequest<{ Body: JournalFetchBody }>,
    reply: FastifyReply
  ) => {
    const { page = 1, limit = 10, ...filters } = request.body;
    const controller = new JournalController();
    const data = await controller.fetchJournal({
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
app.post<{ Body: JournalDetailed }>(
  "/get/detials",
  {
    schema: {
      body: {
        type: "object",
        required: [
          "company_id",
          "table_name",
          "table_row_id"
        ],
        properties: {
          table_row_id: {
            type: "number"
          },
          table_name: {
            type: "string"
          },
          company_id: {
            type: "number"
          },
        }
      }
    }
  },
  async (
    request: FastifyRequest<{ Body: JournalDetailed }>,
    reply: FastifyReply
  ) => {
    const controller = new JournalController();
    const data = await controller.fetchJournalDetail(request.body);
    return reply.code(200).send(data);
  }
);

}