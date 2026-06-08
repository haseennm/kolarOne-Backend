import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import FinancialSalesPurchaseService, { FinancialReportQuery, FinancialReportType, FinancialReportRow } from "./financial-sales-purchase.service";
import FinancialLedgerService from "./financial-ledger.service";

export interface UnifiedFinancialReportRow {
  type: "sale" | "purchase" | "sales_return" | "purchase_return" | "ledger";
  id: number;
  date: string;
  amount: number;
  invoice: string | null;
}

export interface UnifiedFinancialReportSummary {
  total_income: number;
  total_expense: number;
  net: number;
}

export interface UnifiedFinancialReportResponse {
  summary: UnifiedFinancialReportSummary;
  data: UnifiedFinancialReportRow[];
}

export default class FinancialReportService {
  constructor(
    private salesPurchaseService = new FinancialSalesPurchaseService(),
    private ledgerService = new FinancialLedgerService()
  ) {}

  private adjustReportType(reportType = "all"): FinancialReportType {
    if (
      [
        "all",
        "ledger",
        "sales",
        "purchase",
        "sales_return",
        "purchase_return",
        "sales_purchase",
        "returns",
      ].includes(reportType)
    ) {
      return reportType as FinancialReportType;
    }
    throw new AppError("Invalid report_type", 400);
  }

  private isSalesReportType(type: FinancialReportType): boolean {
    return ["all", "sales", "purchase", "sales_return", "purchase_return", "sales_purchase", "returns"].includes(type);
  }

  private isLedgerReportType(type: FinancialReportType): boolean {
    return ["all", "ledger"].includes(type);
  }

  async getUnifiedFinancialReport(query: FinancialReportQuery): Promise<UnifiedFinancialReportResponse> {
    if (!query.level) {
      throw new AppError("level is required", 400);
    }

    const normalizedReportType = this.adjustReportType(query.report_type ?? "all");

    return transaction(async (client) => {
      const data: UnifiedFinancialReportRow[] = [];

      if (this.isSalesReportType(normalizedReportType)) {
        const salesRows = await this.salesPurchaseService.getSalesPurchaseReport(client, query);
        const filtered = this.salesPurchaseService.filterByType(salesRows, normalizedReportType);
        const transformed: UnifiedFinancialReportRow[] = filtered.map((row) => ({
          ...row,
          type: row.type,
        }));

        data.push(...transformed);
      }

      if (this.isLedgerReportType(normalizedReportType)) {
        const ledgerRows = await this.ledgerService.getLedgerReport(client, query);

        const ledgerTransformed: UnifiedFinancialReportRow[] = ledgerRows.map((ledgerRow) => ({
          ...ledgerRow,
          type: (ledgerRow.type as UnifiedFinancialReportRow["type"]),
        }));

        data.push(...ledgerTransformed);
      }

      const sortedData = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let total_income = 0;
      let total_expense = 0;

      sortedData.forEach((item) => {
        const amount = Number(item.amount);
        if (isNaN(amount)) return;
        if (amount > 0) total_income += amount;
        else if (amount < 0) total_expense += Math.abs(amount);
      });

      const summary: UnifiedFinancialReportSummary = {
        total_income,
        total_expense,
        net: Number((total_income - total_expense).toFixed(2)),
      };

      return {
        summary,
        data: sortedData,
      };
    });
  }
}
