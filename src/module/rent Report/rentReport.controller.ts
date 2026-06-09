// report.controller.ts
import { AppError } from "../../utils/AppError";
import { ReportService } from "./rentReport.service";
import { RentReportInput } from "./rentReport.types";

export class ReportController {
  private service = new ReportService();

  // Your existing controllers...

  async getRentReport(body_data: RentReportInput) {
    const { company_id, branch_id, level, cashflow } = body_data;

    /* ================= VALIDATION ================= */
    if (!level) {
      throw new AppError("level is required", 400);
    }

    if (!company_id) {
      throw new AppError("company_id is required", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    /* ================= SERVICE ================= */
    const data = await this.service.getRentReport({
      company_id,
      branch_id,
      level,
      cashflow
    });

    /* ================= RESPONSE ================= */
    return data;
  }
  async getProductWiseReport(body: any) {
    const { company_id, branch_id, level } = body;

    if (!level) throw new AppError("level is required", 400);
    if (level === "company" && !company_id) throw new AppError("company_id is required", 400);
    if (level === "branch" && !branch_id) throw new AppError("branch_id is required", 400);

    return await this.service.getProductWiseRentReport({ company_id, branch_id, level });
  }
  private validateReportInput(body: any) {
    const { level, company_id, branch_id } = body;
    if (!level) throw new AppError("level is required", 400);
    if (!company_id) throw new AppError("company_id is required", 400);
    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }
  }

  async getReturnItemsReport(body: any) {
    this.validateReportInput(body);
    return await this.service.fetchReturnItemsReport(body);
  }

  async getDamageMissingReport(body: any) {
    this.validateReportInput(body);
    return await this.service.fetchDamageMissingReport(body);
  }

  async getOverdayReport(body: any) {
    this.validateReportInput(body);
    return await this.service.fetchOverdayReport(body);
  }
  async getDashbordReport(body: {
    company_id: number;
    branch_id: number;
  }) {
    return await this.service.getRentDashboard(body);
  }
  async getDailyCashFlow(body: {
    branch_id: number;
    month: number;
    year: number;
  }) {
    return await this.service.getDailyCashFlow(body);
  }
}