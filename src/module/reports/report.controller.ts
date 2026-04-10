import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../utils/AppError";
import { ReportService } from "./report.service";
import { GetGSTReportBody, GetReportBody } from "./report.types";



export class ReportController {

  private service = new ReportService();

  async getProfitLossReport(
   body_data:GetReportBody
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
   body_data:GetReportBody
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
   body_data:GetReportBody
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
  async getGSTReport(
   body_data:GetGSTReportBody
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