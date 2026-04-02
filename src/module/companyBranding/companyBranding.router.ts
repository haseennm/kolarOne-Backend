import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import CompanyBrandingController from "./companyBranding.controller";
import { DeleteCompanyBrandingBody } from "./companyBranding.types";

export async function companyBrandingRouter(app: FastifyInstance): Promise<void> {


  app.post("/create", async (request, reply) => {
    const parts = request.parts();

    const body: any = {};
    let logoPath: string | null = null;
    let fullPath: string | null = null;

    try {
      for await (const part of parts) {

        if (part.type === "file") {
          if (!part.filename) continue;

          const uploadDir = path.join(process.cwd(), "uploads");

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const fileName = `${Date.now()}-${part.filename}`;
          fullPath = path.join(uploadDir, fileName);

          await pipeline(part.file, fs.createWriteStream(fullPath));

          logoPath = `/uploads/${fileName}`;
        } else {
          body[part.fieldname.trim()] = part.value;
        }
      }

      if (!body.company_id) {
        throw new Error("company_id is required");
      }

      body.company_id = Number(body.company_id);


      const booleanFields = [
        "invoice_header",
        "report_header",
        "pos_print_header",
        "show_address",
        "show_logo",
        "show_gstin",
        "show_qr_upi",
        "show_invoice_qr",
        "show_return_term"
      ];

      booleanFields.forEach(field => {
        if (body[field] !== undefined) {
          body[field] = body[field] === "true";
        }
      });

      const controller = new CompanyBrandingController();

      const result = await controller.createCompanyBranding({
        ...body,
        logo: logoPath
      });

      return reply.code(201).send({
        status: "Success",
        message: result
      });

    } catch (error) {
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      throw error;
    }
  });


  app.post("/get", async (request: any, reply) => {
    const { company_id } = request.body;

    if (!company_id) {
      throw new Error("company_id is required");
    }

    const controller = new CompanyBrandingController();

    const result = await controller.fetchCompanyBranding(Number(company_id));

    return reply.send(result);
  });


  app.post("/edit", async (request, reply) => {
    const parts = request.parts();

    const body: any = {};
    let logoPath: string | null = null;
    let fullPath: string | null = null;

    try {
      for await (const part of parts) {

        if (part.type === "file") {
          if (!part.filename) continue;

          const uploadDir = path.join(process.cwd(), "uploads");

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const fileName = `${Date.now()}-${part.filename}`;
          fullPath = path.join(uploadDir, fileName);

          await pipeline(part.file, fs.createWriteStream(fullPath));

          logoPath = `/uploads/${fileName}`;
        } else {
          body[part.fieldname.trim()] = part.value;
        }
      }

      if (!body.id) {
        throw new Error("id is required");
      }

      body.id = Number(body.id);

      if (body.company_id) {
        body.company_id = Number(body.company_id);
      }

      if (logoPath) {
        body.logo = logoPath;
      }

      const booleanFields = [
        "show_address",
        "show_gstin",
        "show_invoice_qr",
        "show_logo",
        "show_qr_upi",
        "show_return_term"
      ];

      booleanFields.forEach(field => {
        if (body[field] !== undefined) {
          body[field] = body[field] === "true";
        }
      });

      const controller = new CompanyBrandingController();

      const result = await controller.editCompanyBranding(body);

      return reply.send({
        status: "Success",
        message: result
      });

    } catch (error) {
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      throw error;
    }
  });


  app.post<{ Body: DeleteCompanyBrandingBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id", "deleted_by"],
          properties: {
            company_id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: DeleteCompanyBrandingBody }>, reply: FastifyReply) => {

      const controller = new CompanyBrandingController();
      const result = await controller.deleteCompanyBranding(request.body);

      return reply.code(200).send({
        status: "Success",
        message: result,
      });
    }
  );
}