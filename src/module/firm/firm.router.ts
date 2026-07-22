import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import { pipeline } from "stream/promises";
import {  el } from "../../utils/extra";
import {
  CreateFirmBody,
  DeleteFirmBody,
  EditFirmBody,
  FetchFirmBody,
  FirmLoginBody,
} from "./firm.types";
import FirmController from "./firm.controller";
import { saveMultipartFile } from "../../utils/upload.utils";
import path from "path";

export async function firmRouter(app: FastifyInstance): Promise<void> {

 
  app.post("/create", async (request, reply) => {

    const parts = request.parts();

    const body: any = {};
    let logoDbPath: string | null = null;
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

          logoDbPath = `/uploads/${fileName}`;
          uploadedFullPath = fullPath;
        }

        else {
          const cleanKey = part.fieldname.trim(); // remove accidental spaces
          body[cleanKey] = part.value;
        }
      }

      const requiredFields = [
        "branch_id",
        "company_id",
        "name_of_manager",
        "phone_number",
        "firm_name",
        "firm_code",
        "username",
        "password",
        "status",
        "created_by"
      ];

      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`${field} is required`);
        }
      }
      body.branch_id = Number(body.branch_id);
      body.company_id = Number(body.company_id);

      if (!isNaN(Number(body.created_by))) {
        body.created_by = Number(body.created_by);
      }
      if (body.role) {
        try {
          body.role = JSON.parse(body.role);
        } catch {
          body.role = [];
        }
      }
      const controller = new FirmController();

      const result = await controller.createFirm({
        ...body,
        logo: logoDbPath
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

  // FETCH
  app.post<{ Body: FetchFirmBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1 },
            id: { type: "number" },
            branch_id: { type: "number" },
            search: { type: ["string", "null"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: FetchFirmBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;
      const offset = (page - 1) * limit;

      const controller = new FirmController();

      const firms = await controller.fetchFirm({
        offset,
        filters: {
          ...filters,
          page,
          limit,
        },
      });

      return reply.code(200).send(firms);
     
    }
  );

  // EDIT
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
      if (!body.branch_id) {
        throw new Error("branch_id is required");
      }
      if (!body.updated_by) {
        throw new Error("updated_by is required");
      }
      if (!body.company_id) {
        throw new Error("company_id is required");
      }

      body.id = Number(body.id);
      body.branch_id = Number(body.branch_id);
      body.company_id = Number(body.company_id);

      if (logoPath) {
        body.logo = logoPath;
      }
      if (body.role) {
        try {
          body.role = JSON.parse(body.role);
        } catch {
          body.role = [];
        }
      }
      const controller = new FirmController();
      const firm = await controller.editFirm(body);
      return reply.code(200).send({
        status: "Success",
        message: firm
      });
    } catch (error: any) {
      // delete uploaded file if error happens
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      throw error

    }
  });

  // DELETE
  app.post<{ Body: DeleteFirmBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "deleted_by", "branch_id"],
          properties: {
            r_id: { type: "number" },
            branch_id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      // try {
      const controller = new FirmController();
      const firm = await controller.deleteFirm(request.body);
      return reply.code(201).send(firm);
      // } catch (err: any) {
      //   el(err);
      //   return reply
      //     .status(err.statusCode || 500)
      //     .send({ message: err.message || "Internal Server Error" });
      // }
    }
  );
  app.post<{ Body: FirmLoginBody }>(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["password", "username"],
          properties: {
            password: { type: "string" },
            username: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      // try {
      const controller = new FirmController();
      const firm = await controller.loginFirm(request.body);
      return reply.code(201).send(firm);
      // } catch (err: any) {
      //   el(err);
      //   return reply
      //     .status(err.statusCode || 500)
      //     .send({ message: err.message || "Internal Server Error" });
      // }
    }
  );
}