import { Result } from "pg";
import { executeInTransaction, query, transaction } from "../../config/db";
import { cns, getRecord } from "../../utils/extra";
import { AppError } from "../../utils/AppError";
import { CreateCompanyBrandingParams, DeleteCompanyBrandingParams, EditCompanyBrandingParams } from "./companyBranding.types";

export default class CompanyBrandingService {

  async createCompanyBranding(data: CreateCompanyBrandingParams) {
    const {
      company_id,
      accent_color,
      primary_color,
      secondary_color,
      font_size,
      invoice_header,
      pos_print_header,
      report_header,
      show_address,
      show_gstin,
      show_invoice_qr,
      show_logo,
      show_qr_upi,
      show_return_term,
      tagline,
      logo,
      statusCode,
      remark
    } = data;
    cns("datato insert", data)
    const result = await transaction(async (client) => {

      const is_branding_exist_for_company = await executeInTransaction(
        client,
        `SELECT id FROM company_branding WHERE company_id = $1 AND status != $2`,
        [company_id, 0]
      );

      if (is_branding_exist_for_company.rows.length > 0) {
        throw new AppError("There is already a branding for this company", 400);
      }

      const queryText = `
      INSERT INTO company_branding (
        company_id,
        accent_color,
        primary_color,
        secondary_color,
        font_size,
        invoice_header,
        pos_print_header,
        report_header,
        show_address,
        show_gstin,
        show_invoice_qr,
        show_logo,
        show_qr_upi,
        show_return_term,
        tagline,
        logo,
        status,
        remark
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16,$17,$18
      )
      RETURNING *;
    `;

      const values = [
        company_id,
        accent_color,
        primary_color,
        secondary_color,
        font_size,
        invoice_header,
        pos_print_header,
        report_header,
        show_address,
        show_gstin,
        show_invoice_qr,
        show_logo,
        show_qr_upi,
        show_return_term,
        tagline,
        logo,
        statusCode,
        JSON.stringify(remark)
      ];

      await executeInTransaction(client, queryText, values);

      return "New branding has been created";
    });

    return result;
  }
  async fetchCompanyBranding(company_id: number) {
    const branding = await query(
      `
    SELECT 
      cb.*, 
      c.company_name
    FROM company_branding cb
    JOIN company c ON c.id = cb.company_id
    WHERE cb.company_id = $1 
      AND cb.status != $2
    `,
      [company_id, 0]
    );

    return {
      branding
    };
  }

  async updateCompany_branding(data: EditCompanyBrandingParams) {
    const {
      id,
      company_id,
      remark,
      statusCode,
      accent_color,
      font_size,
      invoice_header,
      logo,
      pos_print_header,
      primary_color,
      report_header,
      secondary_color,
      show_address,
      show_gstin,
      show_invoice_qr,
      show_logo,
      show_qr_upi,
      show_return_term,
      tagline
    } = data;

    const result = await transaction(async (client) => {

      const isBrandingExist = await executeInTransaction(
        client,
        `SELECT * FROM company_branding WHERE id = $1 AND status != 0 AND company_id =$2`,
        [id, company_id]
      );

      if (isBrandingExist.rows.length === 0) {
        throw new AppError("Branding not found or deleted", 404);
      }
      const existing = isBrandingExist.rows[0];
      const queryText = `
      UPDATE company_branding
      SET
        accent_color = $1,
        primary_color = $2,
        secondary_color = $3,
        font_size = $4,
        invoice_header = $5,
        pos_print_header = $6,
        report_header = $7,
        show_address = $8,
        show_gstin = $9,
        show_invoice_qr = $10,
        show_logo = $11,
        show_qr_upi = $12,
        show_return_term = $13,
        tagline = $14,
        logo = $15,
        statusCode = $16,
        remark = CASE
          WHEN remark IS NULL THEN $17::jsonb
          WHEN jsonb_typeof(remark) = 'array'
            THEN remark || $17::jsonb
          ELSE jsonb_build_array(remark) || $17::jsonb
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
      RETURNING *;
    `;

      const values = [
        accent_color ?? existing.accent_color,
        primary_color ?? existing.primary_color,
        secondary_color ?? existing.secondary_color,
        font_size ?? existing.font_size,
        invoice_header ?? existing.invoice_header,
        pos_print_header ?? existing.pos_print_header,
        report_header ?? existing.report_header,
        show_address ?? existing.show_address,
        show_gstin ?? existing.show_gstin,
        show_invoice_qr ?? existing.show_invoice_qr,
        show_logo ?? existing.show_logo,
        show_qr_upi ?? existing.show_qr_upi,
        show_return_term ?? existing.show_return_term,
        tagline ?? existing.tagline,
        logo ?? existing.logo,
        statusCode ?? existing.statuscode,
        JSON.stringify(remark),
        id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return `Branding for company ${rows[0].company_id} updated successfully`;
    });

    return result;
  }

  async deleteCompanyBranding(data: DeleteCompanyBrandingParams) {
    const { company_id, remark } = data;
    const result = transaction(async (client) => {
      const is_row_exist = await executeInTransaction(client,
        `SELECT id FROM company_branding WHERE company_id = $1 AND status != $2`,
        [company_id, 0]);

      if (!is_row_exist) {
        throw new AppError("Data not found or already deleted", 404);
      }

      const queryText = `
      UPDATE company_branding
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE company_id = $3 AND status !=4
      RETURNING *;
    `;

      const values = [
        0, 
        JSON.stringify(remark),
        company_id,
        0
      ];

      await executeInTransaction(client, queryText, values);

      return `Branding For the company Deleted Successfully`;
    })
    return result
  }

}