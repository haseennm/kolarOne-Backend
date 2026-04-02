import { PoolClient } from "pg";
import { AppError } from "../../utils/AppError";
import SaleService from "../sale/sale/sale.service";
import { GetReportSalePurchaseLedger } from "../sale/sale/sale.types";

export type FinancialReportType =
  | "all"
  | "ledger"
  | "sales"
  | "purchase"
  | "sales_return"
  | "purchase_return"
  | "sales_purchase"
  | "returns";

export type FinancialReportLevel = "company" | "branch" | "firm";

export interface FinancialReportQuery {
  report_type?: FinancialReportType;
  level: FinancialReportLevel;
  company_id?: number;
  branch_id?: number;
  firm_id?: number;
  start_date?: string;
  end_date?: string;
}

export interface FinancialReportRow {
  type: "sale" | "purchase" | "sales_return" | "purchase_return";
  id: number;
  date: string;
  amount: number;
  invoice: string | null;
}

function normalizeLevel(level: FinancialReportLevel): "Company" | "Branch" | "Firm" {
  if (level === "company") return "Company";
  if (level === "branch") return "Branch";
  return "Firm";
}

function asFinancialReportRow(row: any): FinancialReportRow {
  return {
    type: String(row.type) as FinancialReportRow["type"],
    id: Number(row.id),
    date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
    amount: Number(row.amount ?? 0),
    invoice: row.invoice != null ? String(row.invoice) : null,
  };
}

export default class FinancialSalesPurchaseService {
  async getSalesPurchaseReport(
    client: PoolClient,
    params: FinancialReportQuery
  ): Promise<FinancialReportRow[]> {
    if (!params.level) {
      throw new AppError("level is required", 400);
    }

    if (params.level === "company" && !params.company_id) {
      throw new AppError("company_id is required for company level", 400);
    }
    if (params.level === "branch" && !params.branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }
    if (params.level === "firm" && !params.firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    const saleService = new SaleService();

    const raw = await saleService.getSalesPurchaseReport(client, {
      level: normalizeLevel(params.level),
      firm_id: params.firm_id,
      branch_id: params.branch_id,
      company_id: params.company_id,
      start_date: params.start_date ?? "",
      end_date: params.end_date ?? "",
    } as GetReportSalePurchaseLedger);

    return raw.map(asFinancialReportRow);
  }

  filterByType(
    rows: FinancialReportRow[],
    reportType: FinancialReportType
  ): FinancialReportRow[] {
    switch (reportType) {
      case "all":
        return rows;
      case "sales":
        return rows.filter((row) => row.type === "sale");
      case "purchase":
        return rows.filter((row) => row.type === "purchase");
      case "sales_return":
        return rows.filter((row) => row.type === "sales_return");
      case "purchase_return":
        return rows.filter((row) => row.type === "purchase_return");
      case "sales_purchase":
        return rows.filter(
          (row) => row.type === "sale" || row.type === "purchase"
        );
      case "returns":
        return rows.filter(
          (row) => row.type === "sales_return" || row.type === "purchase_return"
        );
      default:
        return rows;
    }
  }
}
