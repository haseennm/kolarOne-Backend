import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import SalaryController from "./voice.assistance.controller";
import { ConfirmSalary, VoiceCommandReq, GetSalaryBody } from "./voice.assistance.types";
import { AppError } from "../../utils/AppError";

export async function voiceAssistantRouter(app: FastifyInstance) {
  app.post<{ Body: VoiceCommandReq }>(
    "/generate",
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
      const controller = new SalaryController();

     

      const result = await controller.generateSalary(request.body);

      return reply.code(200).send({
        status: "Success",
        data: result.data,
      });
    }
  );

  app.post<{ Body: ConfirmSalary }>(
    "/confirm",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "entity_id", "entity_type", "updated_by", "status", "final_salary","company_id"],
          properties: {

            r_id: {
              type: "number"
            },
            company_id: {
              type: "number"
            },

            entity_id: { type: "number" },

            entity_type: {
              type: "string",
              enum: ["B", "C"],
            },
            final_salary: {
              type: "number"
            },
            payment_method_id: {
              type: "number"
            },

            status: {
              type: "string",
              enum: ["Paid", "Confirm"]
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: ConfirmSalary }>,
      reply: FastifyReply
    ) => {

      const controller = new SalaryController();
      const data = await controller.confimSalary(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );
  app.post<{ Body: GetSalaryBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["salary_month", "entity_id", "entity_type"],
          properties: {
            salary_month: {
              type: "string"
            },
            entity_id: {
              type: "number"
            },
            entity_type: {
              type: "string",
              enum: ["B", "C"], // Branch or Company
            },
            staff_ids: {
              type: "array",
              items: {
                type: "string"
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: GetSalaryBody }>,
      reply: FastifyReply
    ) => {
      const controller = new SalaryController();
      const data = await controller.getSalary(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });
    }
  );

}