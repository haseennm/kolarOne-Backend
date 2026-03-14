import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import SalaryController from "./salary.controller";
import { ConfirmSalary, GenerateSalaryBody } from "./salary.types";
import { AppError } from "../../utils/AppError";

export async function salaryRouter(app: FastifyInstance) {
  app.post<{ Body: GenerateSalaryBody }>(
    "/generate",
    {
      schema: {
        body: {
          type: "object",
          required: ["from_date", "to_date", "month_salary", "branch_id", "created_by", "staff_ids"],
          properties: {
            from_date: { type: "string", format: "date" },
            to_date: { type: "string", format: "date" },
            month_salary: { type: "string", format: "date" },
            branch_id: { type: "number" },
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
    async (request: FastifyRequest<{ Body: GenerateSalaryBody }>, reply: FastifyReply) => {
      const controller = new SalaryController();
       if (request.body.staff_ids.length === 0) {
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
            required: ["r_id", "branch_id", "updated_by","status","final_salary"],
            properties: {
  
              r_id: {
                type: "number"
              },
  
              branch_id: {
                type: "number"
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
  
}