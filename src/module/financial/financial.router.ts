import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import FinancialReportService from "./financial-report.service";
import { FinancialReportQuery } from "./financial-sales-purchase.service";

export async function financialRouter(app: FastifyInstance) {
    const service = new FinancialReportService();

    app.post<{ Body: FinancialReportQuery }>(
        "/report",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["level"],
                    properties: {
                        report_type: {
                            type: "string",
                            enum: ["all", "ledger", "sales", "purchase", "sales_return", "purchase_return", "sales_purchase", "returns"],
                        },
                        level: {
                            type: "string",
                            enum: ["company", "branch", "firm"],
                        },
                        company_id: {
                            type: "number",
                        },
                        branch_id: {
                            type: "number",
                        },
                        firm_id: {
                            type: "number",
                        },
                        start_date: {
                            type: "string",
                            format: "date",
                        },
                        end_date: {
                            type: "string",
                            format: "date",
                        },
                    },
                    additionalProperties: false,
                },
            },
        },
        async (
            request: FastifyRequest<{ Body: FinancialReportQuery }>,
            reply: FastifyReply
        ) => {

            const report = await service.getUnifiedFinancialReport(request.body);
            return reply.code(200).send(report);

        }
    );
}
