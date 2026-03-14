import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreateLoanBody,
  DeleteLoanBody,
  FetchLoanBody,
  RepayLoanBody
} from "./loan.types";
import LoanController from "./loan.controller";

export async function loanRouter(app: FastifyInstance) {

  // CREATE LOAN
  app.post<{ Body: CreateLoanBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["staff_id", "loan_amount", "branch_id", "company_id", "created_by"],
          properties: {

            staff_id: {
              type: "string"
            },

            loan_amount: {
              type: "number"
            },

            branch_id: {
              type: "number"
            },

            company_id: {
              type: "number"
            },
            created_by: {
              type: "string"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateLoanBody }>,
      reply: FastifyReply
    ) => {

      const controller = new LoanController();
      const data = await controller.createLoan(request.body);

      return reply.code(201).send({
        status: "Success",
        message: data
      });

    }
  );



  // FETCH LOAN
  app.post<{ Body: FetchLoanBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id", "page", "limit"],
          properties: {

            id: { type: "number" },

            staff_id: { type: "string" },

            company_id: { type: "number" },

            branch_id: { type: "number" },

            loan_amount_min: { type: "number" },
            loan_amount_max: { type: "number" },

            paid_amount_min: { type: "number" },
            paid_amount_max: { type: "number" },

            balance_amount_min: { type: "number" },
            balance_amount_max: { type: "number" },

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
      request: FastifyRequest<{ Body: FetchLoanBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new LoanController();

      const data = await controller.fetchLoan({
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



  // REPAY LOAN
  app.post<{ Body: RepayLoanBody }>(
    "/repay",
    {
      schema: {
        body: {
          type: "object",
          required: ["loan_id", "company_id", "branch_id", "pay_amount","updated_by"],
          properties: {

            loan_id: {
              type: "number"
            },
            updated_by: {
              type: "string"
            },

            company_id: {
              type: "number"
            },

            branch_id: {
              type: "number"
            },

            pay_amount: {
              type: "number"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: RepayLoanBody }>,
      reply: FastifyReply
    ) => {

      const controller = new LoanController();
      const data = await controller.rePayLoan(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );



  // DELETE LOAN
  app.post<{ Body: DeleteLoanBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "delete_by", "branch_id"],
          properties: {

            id: {
              type: "number"
            },

            delete_by: {
              type: "string"
            },

            branch_id: {
              type: "number"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: DeleteLoanBody }>,
      reply: FastifyReply
    ) => {

      const controller = new LoanController();
      const data = await controller.deleteLoan(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );

}