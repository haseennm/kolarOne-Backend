import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../utils/AppError";
import { ReportService } from "./report.service";
import { GetGSTReportBody, GetReportBody, OpportunityForecastInput, SalesForecastInput, SalesTrendInput } from "./report.types";
import { SalesTrendService } from "./salesTrend.service";
import { SalesForecastService } from "./salesForecast.service";
import { OpportunityForecastService } from "./opportunityForecast.service";



export class ReportController {

  private service = new ReportService();

  async getProfitLossReport(
    body_data: GetReportBody
  ) {

    const {
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date
    } = body_data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }


    if (level === "company" && !company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    /* ================= SERVICE ================= */

    const data = await this.service.getProfitLossReport({
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date
    });

    /* ================= RESPONSE ================= */

    return data;
  }
  async getReceivablesReport(
    body_data: GetReportBody
  ) {

    const {
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date
    } = body_data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }


    if (level === "company" && !company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    /* ================= SERVICE ================= */

    const data = await this.service.getOutstandingReport({
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date
    });

    /* ================= RESPONSE ================= */

    return data;
  }
  async getExpenseReport(
    body_data: GetReportBody
  ) {

    const {
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date
    } = body_data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }


    if (level === "company" && !company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    /* ================= SERVICE ================= */

    const data = await this.service.getExpenseReport({
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date
    });

    /* ================= RESPONSE ================= */

    return data;
  }
  async salesTrend(
    body_data: SalesTrendInput
  ) {

    const {
      level,
      company_id,
      branch_id,
      firm_id,
      months,
    } = body_data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }


    if (level === "company" && !company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    /* ================= SERVICE ================= */
    const trend_service = new SalesTrendService()
    const data = await trend_service.getSalesTrend({
      level,
      company_id,
      branch_id,
      firm_id,
      months
    });

    /* ================= RESPONSE ================= */

    return data;
  }
  async salesForecast(
    body_data: SalesForecastInput
  ) {

    const {
      level,
      company_id,
      branch_id,
      firm_id,
      forecast_months
    } = body_data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }


    if (level === "company" && !company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    /* ================= SERVICE ================= */
    const trend_service = new SalesForecastService()
    const data = await trend_service.getSalesForecast({
      level,
      company_id,
      branch_id,
      firm_id,
      forecast_months
    });

    /* ================= RESPONSE ================= */

    return data;
  }
  async opportunityForecast(
    body_data: OpportunityForecastInput
  ) {

    const {
      level,
      company_id,
      branch_id,
      firm_id,
      top_items_limit
    } = body_data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }


    if (level === "company" && !company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    /* ================= SERVICE ================= */
    const trend_service = new OpportunityForecastService()
    const data = await trend_service.getOpportunityForecast({
      level,
      company_id,
      branch_id,
      firm_id,
      top_items_limit
    });

    /* ================= RESPONSE ================= */

    return data;
  }
  async getGSTReport(
    body_data: GetGSTReportBody
  ) {

    const {
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date,
      type
    } = body_data;

    /* ================= VALIDATION ================= */

    if (!level) {
      throw new AppError("level is required", 400);
    }


    if (level === "company" && !company_id) {
      throw new AppError("company_id is required for company level", 400);
    }

    if (level === "branch" && !branch_id) {
      throw new AppError("branch_id is required for branch level", 400);
    }

    if (level === "firm" && !firm_id) {
      throw new AppError("firm_id is required for firm level", 400);
    }

    /* ================= SERVICE ================= */

    const data = await this.service.getGSTReport({
      level,
      company_id,
      branch_id,
      firm_id,
      start_date,
      end_date,
      type
    });

    /* ================= RESPONSE ================= */

    return data;
  }
}