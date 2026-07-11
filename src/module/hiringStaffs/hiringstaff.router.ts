import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreateHireStaffBody,
  DeleteHireStaffBody,
  EditStatusHireStaffBody,
  EncryptHireStaffBody,
  FetchHireStaffBody,
} from "./hiringstaff.types";

import HiringStaffController from "./hiringstaff.controller";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";

export async function hiringStaffRouter(app: FastifyInstance) {

  // CREATE STAFF 
  app.post("/create", async (request, reply) => {
    const parts = request.parts();

    const body: any = {};
    let imagePath: string | null = null;

    const attachments: { type: string; url: string }[] = [];
    const uploadedFiles: string[] = [];

    try {
      const uploadDir = path.join(process.cwd(), "uploads");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for await (const part of parts) {
        // ================= FILE HANDLING =================
        if (part.type === "file") {
          if (!part.filename) continue;

          const fileName = `${Date.now()}-${part.filename}`;
          const fullPath = path.join(uploadDir, fileName);

          await pipeline(part.file, fs.createWriteStream(fullPath));

          uploadedFiles.push(fullPath);

          const fileUrl = `/uploads/${fileName}`;

          // Image
          if (part.fieldname === "image") {
            imagePath = fileUrl;
          }

          // Attachment file
          else if (part.fieldname.startsWith("attachments")) {
            const match = part.fieldname.match(/attachments\[(\d+)\]\[file\]/);

            if (match) {
              const index = Number(match[1]);

              if (!attachments[index]) {
                attachments[index] = { type: "", url: "" };
              }

              attachments[index].url = fileUrl;
            }
          }
        }

        // ================= FIELD HANDLING =================
        else {
          const field = part.fieldname.trim();
          let value: any = part.value;

          // Multi-value fields
          if (field === "role" || field === "languages_known") {
            if (!body[field]) {
              body[field] = [];
            }
            body[field].push(value);
            continue;
          }

          // Attachment type parsing
          if (field.startsWith("attachments[")) {
            const match = field.match(/attachments\[(\d+)\]\[(\w+)\]/);

            if (match) {
              const index = Number(match[1]);
              const key = match[2] as "type" | "url";

              if (!attachments[index]) {
                attachments[index] = { type: "", url: "" };
              }

              attachments[index][key] = value;
            }
            continue;
          }

          body[field] = value;
        }
      }

      // ================= VALIDATION =================
      const requiredFields = [
        "full_name",
        "phone_number",
        "entity_type",
        "entity_id",
        "company_id",
      ];

      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`${field} is required`);
        }
      }

      // ================= TYPE CONVERSION =================
      body.entity_id = Number(body.entity_id);
      body.company_id = Number(body.company_id);
      body.branch_id = body.branch_id ? Number(body.branch_id) : null;
      body.expected_salary = body.expected_salary
        ? Number(body.expected_salary)
        : null;


      body.image = imagePath;
      body.attachments = attachments.filter(Boolean);

      const controller = new HiringStaffController();

      const result = await controller.createHireStaff(body);

      return reply.code(201).send({
        status: "Success",
        message: result,
      });
    } catch (error: any) {
      console.log(error)
      // Cleanup uploaded files on error
      for (const file of uploadedFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }

      console.error(error);
      return reply.status(500).send({
        status: "Error",
        message: error.message,
      });
    }
  });



  // FETCH STAFF
  app.post<{ Body: FetchHireStaffBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",

          properties: {
            id: { type: "string" },

            company_id: { type: "number" },
            branch_id: { type: "number" },
            status: { type: "string", enum: ["Accept", "Deny", "Hold", "Pending"] },
            search: { type: "string" },

            page: {
              type: "number",
              minimum: 1
            },

            limit: {
              type: "number",
              minimum: 1
            }
          },

          oneOf: [
            {
              required: ["company_id"],
              not: {
                required: ["branch_id"]
              }
            },
            {
              required: ["branch_id"],
              not: {
                required: ["company_id"]
              }
            }
          ],
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: FetchHireStaffBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new HiringStaffController();

      const data = await controller.fetchHireStaff({
        offset: (page - 1) * limit,
        filters: {
          ...filters,
          page,
          limit
        }
      });
      return reply.code(200).send(data);

    }
  );



  // EDIT STAFF
  app.post<{ Body: EditStatusHireStaffBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "updated_by", "entity_id", "entity_type", "status"],
          properties: {
            id: { type: "string" },
            updated_by: { type: ["number", "string"] },
            entity_type: { type: "string" },
            entity_id: { type: "number" },
            status: { type: "string", enum: ["Accepted", "Denied", "Hold"] },
            search: { type: "string" }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EditStatusHireStaffBody }>,
      reply: FastifyReply
    ) => {
      const controller = new HiringStaffController();

      const data = await controller.editHireStaff(request.body);

      return reply.code(200).send(data);
    }
  );



  // DELETE STAFF
  app.post<{ Body: DeleteHireStaffBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "company_id", "entity_id", "deleted_by"],
          properties: {

            r_id: { type: "string" },
            company_id: { type: "number" },
            entity_id: { type: "number" },
            entity_type: { type: "string", enum: ["B", "C", "F"] },
            deleted_by: { type: "string" }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: DeleteHireStaffBody }>,
      reply: FastifyReply
    ) => {

      const controller = new HiringStaffController();
      const data = await controller.deleteHireStaff(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );
  app.post<{ Body: EncryptHireStaffBody }>(
    "/encryption",
    {
      schema: {
        body: {
          type: "object",
          required: ["type", "company_id", "id", "name"],
          properties: {

            type: { type: "string" },
            company_id: { type: "number" },
            id: { type: "number" },
            name: { type: "string" }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EncryptHireStaffBody }>,
      reply: FastifyReply
    ) => {

      const controller = new HiringStaffController();
      const data = await controller.encryptUrl(request.body);

      return reply.code(200).send({
        status: "Success",
        url: data
      });

    }
  );
  type DecryptBody = {
    url: string;
  };

  app.post<{ Body: DecryptBody }>(
    "/decryption",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: DecryptBody }>,
      reply: FastifyReply
    ) => {

      const controller = new HiringStaffController();


      const data = await controller.decryptUrl(request.body.url);

      return reply.code(200).send({
        status: "Success",
        url: data
      });
    }
  );

}