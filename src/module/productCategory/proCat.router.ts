import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import { pipeline } from "stream/promises";
import { cns, el } from "../../utils/extra";
import ProCatController from "./proCat.controller";
import path from "path";
import { DeleteProductCatBody, FetchProductCatBody } from "./proCat.types";
import { error } from "console";

export async function productCategoryRouter(app: FastifyInstance): Promise<void> {

  app.post("/create", async (request, reply) => {

    const parts = request.parts();

    const body: any = {};
    let image_db_path: string | null = null;
    let uploadedFullPath: string | null = null;

    try {

      for await (const part of parts) {

        if (part.type === "file") {

          const uploadDir = path.join(process.cwd(), "uploads");

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const fileName = `${Date.now()}-${part.filename}`;
          const fullPath = path.join(uploadDir, fileName);

          await pipeline(part.file, fs.createWriteStream(fullPath));

          image_db_path = `/uploads/${fileName}`;
          uploadedFullPath = fullPath;
        }

        else {
          const cleanKey = part.fieldname.trim();
          body[cleanKey] = part.value;
        }
      }


      const requiredFields = [
        "name",
        "created_by",
        "company_id"
      ];

      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`${field} is required`);
        }
      }


      body.company_id = Number(body.company_id);
      if (body.parent_id === "null" || body.parent_id === undefined) {
        body.parent_id = null
      } else {
        body.parent_id = Number(body.parent_id);
      }


      const controller = new ProCatController();

      const result = await controller.createProductCat({
        ...body,
        image: image_db_path,
        parent_id: body.parent_id
      });

      return reply.code(201).send({
        status: "Success",
        message: result
      });

    } catch (error: any) {

      if (uploadedFullPath && fs.existsSync(uploadedFullPath)) {
        fs.unlinkSync(uploadedFullPath);
      }

      throw error
    }
  });

  app.post<{ Body: FetchProductCatBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id"],
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1 },
            id: { type: "number" },
            parent_id: { type: "number" },
            company_id: { type: "number" },
            search: { type: ["string", "null"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: FetchProductCatBody }>,
      reply: FastifyReply
    ) => {
      cns(request.url, request.body);

      const { page = 1, limit = 10, ...filters } = request.body;
      const offset = (page - 1) * limit;

      const controller = new ProCatController();

      const product_category = await controller.fetchProCat({
        offset,
        filters: {
          ...filters,
          page,
          limit,
        },
      });

      return reply.code(200).send(product_category);

    }
  );

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

      if (!body.company_id) {
        throw new Error("company_id is required");
      }

      if (!body.updated_by) {
        throw new Error("updated_by is required");
      }

      body.id = Number(body.id);
      body.branch_id = Number(body.branch_id);

      if (logoPath) {
        body.logo = logoPath;
      }

      const controller = new ProCatController();
      const edited_product_cat = await controller.editProductCat(body);

      return reply.code(200).send({
        status: "Success",
        message: edited_product_cat
      });

    } catch (err: any) {

      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      throw error
    }
  });

  app.post<{ Body: DeleteProductCatBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "deleted_by", "company_id"],
          properties: {
            r_id: { type: "number" },
            company_id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      cns(request.url, request.body);
      const controller = new ProCatController();
      const deleted_product_cat = await controller.deleteProductCat(request.body);
      return reply.code(201).send({
        status: "Success",
        message: deleted_product_cat
      });
    }
  );
}