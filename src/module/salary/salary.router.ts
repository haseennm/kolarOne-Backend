import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import SalaryController from "./salary.controller";
import { ConfirmSalary, GenerateSalaryBody, GetSalaryBody } from "./salary.types";
import { AppError } from "../../utils/AppError";

export async function salaryRouter(app: FastifyInstance) {
  app.post<{ Body: GenerateSalaryBody }>(
    "/generate",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "from_date",
            "to_date",
            "month_salary",
            "entity_id",
            "entity_type",
            "created_by",
            "staff_ids"
          ],
          properties: {
            from_date: { type: "string", format: "date" },
            to_date: { type: "string", format: "date" },
            month_salary: { type: "string", format: "date" },

            entity_id: { type: "number" },

            entity_type: {
              type: "string",
              enum: ["B", "C"], // Branch or Company
            },

            created_by: { type: "string" },

            staff_ids: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: GenerateSalaryBody }>,
      reply: FastifyReply
    ) => {
      const controller = new SalaryController();

      if (!request.body.staff_ids || request.body.staff_ids.length === 0) {
        throw new AppError("At least one staff member must be selected", 400);
      }

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
            bonus: {
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