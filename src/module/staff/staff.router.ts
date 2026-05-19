import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CreateStaffBody,
  DeleteStaffBody,
  EditStaffBody,
  FetchStaffBody,
  StaffLoginBody
} from "./staff.types";

import StaffController from "./staff.controller";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";

export async function staffRouter(app: FastifyInstance) {

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
        "created_by",
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
      body.salary = body.salary ? Number(body.salary) : null;
      body.expected_salary = body.expected_salary
        ? Number(body.expected_salary)
        : null;

      // Convert roles to numbers
      if (body.role) {
        body.role = body.role.map((r: any) => Number(r));
      }

      body.image = imagePath;
      body.attachments = attachments.filter(Boolean);

      const controller = new StaffController();

      const result = await controller.createStaff(body);

      return reply.code(201).send({
        status: "Success",
        message: result,
      });
    } catch (error: any) {
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
  app.post<{ Body: FetchStaffBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          required: ["company_id"],
          properties: {

            id: { type: "string" },

            company_id: { type: "number" },

            entity_type: { type: "string" },

            entity_id: { type: "number" },

            role: {
              type: "array",
              items: { type: "number" }
            },

            status: { type: "number" },

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

          allOf: [
            {
              if: {
                required: ["entity_id"]
              },
              then: {
                required: ["entity_type"]
              }
            },
            {
              if: {
                required: ["entity_type"]
              },
              then: {
                required: ["entity_id"]
              }
            }
          ]

        }
      }
    },
    async (
      request: FastifyRequest<{ Body: FetchStaffBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new StaffController();

      const data = await controller.fetchStaff({
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
  app.post("/edit", async (request, reply) => {
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
        if (part.type === "file") {
          if (!part.filename) continue;
          const safeFileName = path.basename(part.filename || "file");

          const fileName = `${Date.now()}-${safeFileName}`;
          const fullPath = path.join(uploadDir, fileName);

          await pipeline(part.file, fs.createWriteStream(fullPath));

          uploadedFiles.push(fullPath);

          const fileUrl = `/uploads/${fileName}`;

          if (part.fieldname === "image") {
            imagePath = fileUrl;
          }

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

        else {
          const field = part.fieldname.trim();
          let value: any = part.value;

          if (field === "languages_known") {
            if (!body.languages_known) body.languages_known = [];
            body.languages_known.push(value);
            continue;
          }

          if (field === "role") {
            if (!body.role) body.role = [];
            body.role.push(Number(value));
            continue;
          }

          if (field.startsWith("attachments[")) {
            const match = field.match(/attachments\[(\d+)\]\[(\w+)\]/);

            if (match) {
              const index = Number(match[1]);
              const key = match[2];

              if (!attachments[index]) {
                attachments[index] = { type: "", url: "" };
              }

              if (key === "type") {
                attachments[index].type = value;
              }
            }
            continue;
          }

          body[field] = value;
        }
      }

      const requiredFields = ["id", "updated_by", "entity_id", "entity_type"];

      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`${field} is required`);
        }
      }
      body.company_id = body.company_id ? Number(body.company_id) : undefined;
      body.entity_id = body.entity_id ? Number(body.entity_id) : undefined;

      body.salary = body.salary ? Number(body.salary) : undefined;
      body.expected_salary = body.expected_salary
        ? Number(body.expected_salary)
        : undefined;

      if (imagePath) body.image = imagePath;

      if (attachments.length) {
        body.attachments = attachments.filter(Boolean);
      }


      const controller = new StaffController();

      const result = await controller.editStaff(body);

      return reply.code(200).send({
        status: "Success",
        message: result,
      });

    } catch (error: any) {
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



  // DELETE STAFF
  app.post<{ Body: DeleteStaffBody }>(
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
      request: FastifyRequest<{ Body: DeleteStaffBody }>,
      reply: FastifyReply
    ) => {

      const controller = new StaffController();
      const data = await controller.deleteStaff(request.body);

      return reply.code(200).send({
        status: "Success",
        message: data
      });

    }
  );


  app.post<{ Body: StaffLoginBody }>(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["password", "email"],
          properties: {
            password: { type: "string" },
            email: {
              type: "string",
              format: "email"
            },
          },
        },
      },
    },
    async (request, reply) => {
      const controller = new StaffController();
      const staff = await controller.loginStaff(request.body);
      return reply.code(201).send(staff);

    }
  );

}