import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import RecentActivityController from "./recent-activity.controller";
import { RecentActivityRequest } from "./recent-activity.types";

export async function recentActivityRouter(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RecentActivityRequest }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["entity_id", "entity_type"],
          properties: {
            entity_id: { type: "number" },
            entity_type: { type: "string", enum: ["C", "B", "F"] },
            limit: { type: "number", minimum: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RecentActivityRequest }>, reply: FastifyReply) => {
      const controller = new RecentActivityController();
      const activities = await controller.fetchRecentActivity(request.body);
      return reply.code(200).send({ status: "Success", data: activities });
    }
  );
}
