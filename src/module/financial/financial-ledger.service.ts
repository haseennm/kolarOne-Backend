import { PoolClient } from "pg";
import { AppError } from "../../utils/AppError";
import LedgerTransactionService from "../ledgertransaction/ledgertransaction.service";
import { FinancialReportQuery, FinancialReportRow, FinancialReportLevel } from "./financial-sales-purchase.service";

export interface FinancialLedgerRow {
  type: "ledger";
  id: number;
  date: string;
  amount: number;
  invoice: string | null;
}

function asLedgerRow(row: any): FinancialLedgerRow {
  return {
    type: "ledger",
    id: Number(row.id),
    date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
    amount: Number(row.amount ?? 0),
    invoice: row.invoice != null ? String(row.invoice) : null,
  };
}

export default class FinancialLedgerService {
  private _validateParams({ level, company_id, branch_id, firm_id }: FinancialReportQuery) {
    if (!level) throw new AppError("level is required", 400);
    if (level === "company" && !company_id)
      throw new AppError("company_id is required for company level", 400);
    if (level === "branch" && !branch_id)
      throw new AppError("branch_id is required for branch level", 400);
    if (level === "firm" && !firm_id)
      throw new AppError("firm_id is required for firm level", 400);

    if (!["company", "branch", "firm"].includes(level)) {
      throw new AppError("invalid level, expected company|branch|firm", 400);
    }
  }

  async getLedgerReport(
    client: PoolClient,
    params: FinancialReportQuery
  ): Promise<FinancialLedgerRow[]> {
    this._validateParams(params);

    const service = new LedgerTransactionService();
    const queryParams = {
      ...params,
      level: (params.level as FinancialReportLevel) as string,
    };

    const raw = await service.getLedgerReport(client, queryParams as any);

    return raw.map(asLedgerRow);
  }
}
