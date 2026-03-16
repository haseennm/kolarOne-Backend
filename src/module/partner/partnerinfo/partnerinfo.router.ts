import { FastifyInstance } from "fastify";
import PartnerController from "./partnerinfo.controller";
import { CreatePartnerBody, EditPartnerBody, FetchPartnerBody, DeletePartnerBody } from "./partnerinfo.types";
import { AppError } from "../../../utils/AppError";

export async function partnerRouter(app: FastifyInstance) {
  const controller = new PartnerController();

  // CREATE
  app.post<{ Body: CreatePartnerBody }>("/create", {
    schema: {
      body: {
        type: "object",
        required: ["name", "address", "phone_number", "city", "district", "pincode", "company_id", "status", "created_by"],
        properties: {
          company_id: { type: "number" },
          name: { type: "string", minLength: 2, maxLength: 150 },
          address: { type: "string" },
          phone_number: { type: "string", minLength: 10, maxLength: 20 },
          city: { type: "string", maxLength: 100 },
          district: { type: "string", maxLength: 100 },
          state: { type: ["string", "null"], maxLength: 100 },
          pincode: { type: "string", minLength: 6, maxLength: 10 },
          status: { type: "string" },
          created_by: { type: "string" }
        }
      }
    }
  }, async (req, reply) => {
    const res = await controller.createPartner(req.body);
    return reply.code(201).send({ status: "Success", message: res });
  });

  // FETCH
  app.post<{
    Body: FetchPartnerBody;
  }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false, // ❗ blocks unknown fields
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            id: { type: "string" },
            company_id: { type: "number" },
            search: { type: ["string", "null"] },
            status: { type: "number" }
          }
        }
      }
    },
    async (req, reply) => {
      const { page = 1, limit = 10, ...filters } = req.body;
      const allowedFields = ["page", "limit", "id", "company_id", "search", "status"];

      const extraFields = Object.keys(req.body).filter(
        key => !allowedFields.includes(key)
      );

      console.log("first",req.body)
      if (extraFields.length) {
        throw new AppError(`Invalid fields: ${extraFields.join(", ")}`,500);
      }
      const res = await controller.fetchPartners({
        offset: (page - 1) * limit,
        filters: { ...filters, page, limit }
      });

      return reply.send(res);
    }
  );

  // EDIT
  app.post<{ Body: EditPartnerBody }>("/edit", {
    schema: {
      body: {
        type: "object",
        required: ["id", "company_id", "updated_by"],
        properties: {
          id: { type: "string", format: "uuid" },
          company_id: { type: "number" },
          name: { type: "string" },
          status: { type: ["string", "null"] }
        }
      }
    }
  }, async (req, reply) => {
    const res = await controller.editPartner(req.body);
    return reply.send({ status: "Success", message: res });
  });

  // DELETE
  app.post<{ Body: DeletePartnerBody }>("/delete", {
    schema: {
      body: {
        type: "object",
        required: ["id", "company_id", "deleted_by"],
        properties: {
          id: { type: "string", format: "uuid" },
          company_id: { type: "number" },
          deleted_by: { type: "string" }
        }
      }
    }
  }, async (req, reply) => {
    const res = await controller.deletePartner(req.body);
    return reply.send({ status: "Success", message: res });
  });
}