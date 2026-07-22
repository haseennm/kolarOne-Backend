import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BulkEditPaymentRequest, GetPaymentTransactionsRequest } from "./paymenttransaction.types";
import PaymentTransactionController from "./paymenttransaction.controller";



export async function paymentTransactionRouter(app: FastifyInstance) {



  app.post<{ Body: GetPaymentTransactionsRequest }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["firm_id", "ref_type"],
          properties: {
            firm_id: { type: "number" },
            ref_type: {
              type: "array", //   Changed from "string" to "array"
              items: {
                type: "string",
                enum: [
                  "sale_settlement",
                  "sale",
                  "sale_return",
                  "purchase_settlement",
                  "purchase",
                  "purchase_return",
                  "balance",
                  "loan",
                  "loanrepay",
                  "salary",
                  "ledger_transaction"
                ]
              }
            },
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
            ref_id: { type: "number" },
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, default: 10 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: GetPaymentTransactionsRequest }>,
      reply: FastifyReply
    ) => {
      const controller = new PaymentTransactionController();

      const data = await controller.fetchPayment(request.body);

      return reply.code(200).send(data);
    }
  );
  app.post<{ Body: BulkEditPaymentRequest }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id","firm_id", "payments"],
          properties: {
            firm_id: { type: "number" },
            company_id: { type: "number" },
            payments: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["payment_id"],
                properties: {
                  payment_id: { type: "number" },
                  amount: { type: "number" },
                  payment_method_id: { type: "number", nullable: true },
                  transaction_reference: { type: "string", nullable: true },
                  status: { type: "number" }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: BulkEditPaymentRequest }>,
      reply: FastifyReply
    ) => {
      const controller = new PaymentTransactionController();
      
      await controller.editPayment(request.body);

      return reply.code(200).send({
        success: true,
        message: "Payment transactions updated successfully"
      });
    }
  );

}
