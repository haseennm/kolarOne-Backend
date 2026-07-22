import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import VendorController from "./vendor.controller";
import {
  AddNewFirm,
  CreateVendorBody,
  DeleteVendorBody,
  EditVendorBody,
  FetchVendorBody,
  GetVendorReportBody,
  RemoveFirmVendor
} from "./vendor.types";

export async function vendorRouter(app: FastifyInstance) {

  // CREATE
  app.post<{ Body: CreateVendorBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["vendor_name", "company_id", "status", "created_by", "gstin"],
          properties: {
            company_id: { type: "number" },
            firm_id: {
              type: "array",
              items: {
                type: "number"
              }
            },

            vendor_name: {
              type: "string",
              minLength: 2,
              maxLength: 255
            },

            email: {
              type: ["string", "null"],
              format: "email",
              maxLength: 255
            },

            phone_number: {
              type: ["string", "null"],
              minLength: 10,
              maxLength: 20
            },

            alternate_phone: {
              type: ["string", "null"],
              minLength: 10,
              maxLength: 20
            },

            address: {
              type: ["string", "null"]
            },

            gstin: {
              type: ["string", "null"],
              minLength: 15,
              maxLength: 15
            },

            pan: {
              type: ["string", "null"],
              minLength: 10,
              maxLength: 10
            },

            state_code: {
              type: ["string", "null"],
              minLength: 2,
              maxLength: 2
            },

            status: {
              type: "string"
            },

            created_by: {
              type: "string"
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateVendorBody }>,
      reply: FastifyReply
    ) => {

      const controller = new VendorController();

      const vendor = await controller.createVendor(request.body);

      return reply.code(201).send({
        status: "Success",
        message: vendor
      });
    }
  );

  // FETCH
  app.post<{ Body: FetchVendorBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1 },

            id: {
              type: "string",
              format: "uuid"
            },

            company_id: { type: "number" },

            search: {
              type: ["string", "null"]
            },

            status: { type: "number" }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: FetchVendorBody }>,
      reply: FastifyReply
    ) => {

      const { page = 1, limit = 10, ...filters } = request.body;

      const controller = new VendorController();

      const vendors = await controller.fetchVendor({
        offset: (page - 1) * limit,
        filters: {
          ...filters,
          page,
          limit
        }
      });

      return reply.code(200).send(vendors);
    }
  );

  // EDIT
  app.post<{ Body: EditVendorBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "updated_by","company_id"],
          properties: {
            id: {
              type: "string",
              format: "uuid"
            },
            company_id: {
              type: "number"
            },

            vendor_name: {
              type: "string",
              minLength: 2,
              maxLength: 255
            },

            email: {
              type: ["string", "null"],
              format: "email"
            },

            phone_number: {
              type: ["string", "null"],
              minLength: 10,
              maxLength: 20
            },

            alternate_phone: {
              type: ["string", "null"],
              minLength: 10,
              maxLength: 20
            },

            address: {
              type: ["string", "null"]
            },

            gstin: {
              type: ["string", "null"],
              minLength: 15,
              maxLength: 15
            },

            pan: {
              type: ["string", "null"],
              minLength: 10,
              maxLength: 10
            },

            state_code: {
              type: ["string", "null"],
              minLength: 2,
              maxLength: 2
            },

            status: {
              type: ["string", "null"]
            },

            updated_by: {
              type: "string"
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: EditVendorBody }>,
      reply: FastifyReply
    ) => {

      const controller = new VendorController();

      const vendor = await controller.editVendor(request.body);

      return reply.code(200).send({
        status: "Success",
        message: vendor
      });
    }
  );
  app.post<{ Body: AddNewFirm }>(
    "/add/firm",
    {
      schema: {
        body: {
          type: "object",
          required: ["vendor_id", "firm_id", "firm_name","company_id"],
          properties: {
            vendor_id: {
              type: "string",
              format: "uuid"
            },
            firm_id: {
              type: "number"
            },

            firm_name: {
              type: "string",
              minLength: 2,
              maxLength: 255
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: AddNewFirm }>,
      reply: FastifyReply
    ) => {

      const controller = new VendorController();

      const vendor = await controller.addnewFirm(request.body);

      return reply.code(200).send({
        status: "Success",
        message: vendor
      });
    }
  );

  // DELETE
  app.post<{ Body: DeleteVendorBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "company_id", "deleted_by"],
          properties: {
            r_id: {
              type: "string",
              format: "uuid"
            },

            company_id: { type: "number" },

            deleted_by: {
              type: "string"
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: DeleteVendorBody }>,
      reply: FastifyReply
    ) => {

      const controller = new VendorController();

      const vendor = await controller.deleteVendor(request.body);

      return reply.code(200).send({
        status: "Success",
        message: vendor
      });
    }
  );
  app.post<{ Body: RemoveFirmVendor }>(
    "/remove/firm",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "company_id", "firm_id", "firm_name"],
          properties: {
            r_id: {
              type: "string",
              format: "uuid"
            },

            company_id: { type: "number" },
            firm_id: { type: "number" },

            firm_name: {
              type: "string"
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: RemoveFirmVendor }>,
      reply: FastifyReply
    ) => {

      const controller = new VendorController();

      const vendor = await controller.removeFirmVendor(request.body);

      return reply.code(200).send({
        status: "Success",
        message: vendor
      });
    }
  );

  app.post<{ Body: GetVendorReportBody }>(
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

            firm_id: {
              type: ["number", "null"]
            },

            branch_id: {
              type: ["number", "null"]
            },

            company_id: {
              type: ["number", "null"]
            },

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
      request: FastifyRequest<{ Body: GetVendorReportBody }>,
      reply: FastifyReply
    ) => {

      const controller = new VendorController();

      const report = await controller.getVendorReport(request.body);

      return reply.code(200).send({
        status: "Success",
        data: report
      });
    }
  );
}