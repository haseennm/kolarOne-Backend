import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import TodaySnapdealController from "./todaySnapdeal.controller";
import { TodaySnapdealRequest } from "./todaySnapdeal.types";

export async function todaySnapdealRouter(app: FastifyInstance): Promise<void> {
  app.post<{ Body: TodaySnapdealRequest }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["entity_id", "entity_type"],
          properties: {
            entity_id: { type: "number" },
            entity_type: { type: "string", enum: ["C", "B", "F"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: TodaySnapdealRequest }>,
      reply: FastifyReply
    ) => {
      const controller = new TodaySnapdealController();
      const data = await controller.fetchSnapshot(request.body);
      return reply.code(200).send({ success: true, data });
    }
  );
}
