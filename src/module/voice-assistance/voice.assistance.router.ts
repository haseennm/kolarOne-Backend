import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import SalaryController from "./voice.assistance.controller";
import { VoiceCommandReq } from "./voice.assistance.types";
import { AppError } from "../../utils/AppError";
import VoiceAssistController from "./voice.assistance.controller";

export async function voiceAssistantRouter(app: FastifyInstance) {
  app.post<{ Body: VoiceCommandReq }>(
    "/assist",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "entity_id",
            "entity_type",
            "message"
          ],
          properties: {
            message: { type: "string" },
            entity_id: { type: "number" },
            entity_type: {
              type: "string",
              enum: ["B", "C"], // Branch or Company
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: VoiceCommandReq }>,
      reply: FastifyReply
    ) => {
      const controller = new VoiceAssistController();

     

      const result = await controller.voiceAssist(request.body);

      return reply.code(200).send({
        status: "Success",
        data: result,
      });
    }
  );


}