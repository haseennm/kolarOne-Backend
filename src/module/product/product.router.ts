import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import ProductController from "./product.controller";
import {
  CreateProductBody,
  EditProductBody,
  DeleteProductBody,
  GetProductReport,
} from "./product.types";

export async function productRouter(app: FastifyInstance): Promise<void> {

  app.post("/create", async (request, reply) => {
    const parts = request.parts();
    const body: any = {};

    let image_db_path: string | null = null;
    let uploadedFullPath: string | null = null;

    try {
      for await (const part of parts) {
        if (part.type === "file") {
          if (!part.filename) continue;

          const uploadDir = path.join(process.cwd(), "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const fileName = `${Date.now()}-${part.filename}`;
          const fullPath = path.join(uploadDir, fileName);

          await pipeline(part.file, fs.createWriteStream(fullPath));

          image_db_path = `/uploads/${fileName}`;
          uploadedFullPath = fullPath;
        } else {
          body[part.fieldname.trim()] = part.value;
        }
      }

      const requiredFields = [
        "category_id",
        "name",
        "base_price",
        "company_id",
        "created_by",
      ];

      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`${field} is required`);
        }
      }

      body.category_id = Number(body.category_id);
      body.company_id = Number(body.company_id);
      body.base_price = Number(body.base_price);

      body.brand_id = body.brand_id ? Number(body.brand_id) : null;

      body.cgst_rate = body.cgst_rate ? Number(body.cgst_rate) : null;
      body.sgst_rate = body.sgst_rate ? Number(body.sgst_rate) : null;
      body.igst_rate = body.igst_rate ? Number(body.igst_rate) : null;

      const controller = new ProductController();

      const result = await controller.createProduct({
        ...body,
        image: image_db_path,
      } as CreateProductBody);

      return reply.code(201).send({
        status: "Success",
        message: result,
      });

    } catch (error: any) {
      if (uploadedFullPath && fs.existsSync(uploadedFullPath)) {
        fs.unlinkSync(uploadedFullPath);
      }
      throw error;
    }
  });

  app.post(
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
            category_id: { type: "number" },
            company_id: { type: "number" },
            search: { type: ["string", "null"] },
            firm_id: { type: ["number", "null"] },
            is_sale: { type: ["boolean", "null"] },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { page = 1, limit = 10, ...filters }: any = request.body;
      const offset = (page - 1) * limit;

      const controller = new ProductController();

      const products = await controller.fetchProducts({
        offset,
        filters: {
          ...filters,
          page,
          limit,
        },
      });

      return reply.code(200).send(products);
    }
  );

  app.post("/edit", async (request, reply) => {
    const parts = request.parts();
    const body: any = {};

    let imagePath: string | null = null;
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

          imagePath = `/uploads/${fileName}`;
        } else {
          body[part.fieldname.trim()] = part.value;
        }
      }

      if (!body.id) throw new Error("id is required");
      if (!body.company_id) throw new Error("company_id is required");
      if (!body.updated_by) throw new Error("updated_by is required");

      body.id = Number(body.id);
      body.company_id = Number(body.company_id);

      if (body.category_id) body.category_id = Number(body.category_id);
      if (body.brand_id)
        body.brand_id = body.brand_id === "null" ? null : Number(body.brand_id);

      if (body.base_price) body.base_price = Number(body.base_price);

      if (body.cgst_rate)
        body.cgst_rate = body.cgst_rate === "null" ? null : Number(body.cgst_rate);
      if (body.sgst_rate)
        body.sgst_rate = body.sgst_rate === "null" ? null : Number(body.sgst_rate);
      if (body.igst_rate)
        body.igst_rate = body.igst_rate === "null" ? null : Number(body.igst_rate);

      if (body.status) body.status = Number(body.status);

      if (imagePath) body.image = imagePath;

      const controller = new ProductController();
      const result = await controller.editProduct(body as EditProductBody);

      return reply.code(200).send({
        status: "Success",
        message: result,
      });

    } catch (err: any) {
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      throw err;
    }
  });

  app.post<{ Body: DeleteProductBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "company_id", "deleted_by"],
          properties: {
            r_id: { type: "number" },
            company_id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const controller = new ProductController();
      const result = await controller.deleteProduct(request.body);

      return reply.code(200).send({
        status: "Success",
        message: result,
      });
    }
  );
   app.post<{
  Body: GetProductReport;
}>(
  "/reports",
  {
    schema: {
      body: {
        type: "object",
        required: ["level"],
        properties: {
          level: {
            type: "string",
            enum: ["firm", "branch", "company"]
          },

          firm_id: { type: ["number", "null"] },
          branch_id: { type: ["number", "null"] },
          company_id: { type: ["number", "null"] },

          start_date: {
            type: ["string", "null"],
            pattern: "^\\d{4}-\\d{2}-\\d{2}$"
          },

          end_date: {
            type: ["string", "null"],
            pattern: "^\\d{4}-\\d{2}-\\d{2}$"
          }
        }
      }
    }
  },
  async (
    request: FastifyRequest<{ Body: GetProductReport }>,
    reply: FastifyReply
  ) => {

      const controller = new ProductController();
      const data = await controller.getProductReport(request.body);

      return reply.code(200).send({
        status: "Success",
        data
      });
     
  }
);
}