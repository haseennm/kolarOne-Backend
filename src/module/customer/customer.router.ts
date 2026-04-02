import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { cns } from "../../utils/extra";
import {
  CreateCustomerBody,
  DeleteCustomerBody,
  EditCustomerBody,
  FetchCustomerBody,
} from "./customer.types";
import CustomerController from "./customer.controller";

export async function customerRouter(app: FastifyInstance): Promise<void> {

  app.post<{ Body: CreateCustomerBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "company_id",
            "customer_type",
            "customer_name",
            "status",
            "created_by",
            "phone_number"
          ],
          properties: {
            company_id: { type: "number" },
            customer_type: {
              type: "string",
              enum: ["B2B", "B2C", "both"]
            },
            customer_name: { type: "string", minLength: 2 },
            gender: {
              type: ["string", "null"],
              enum: ["MALE", "FEMALE", "OTHER", null]
            },
            email: {
              type: ["string", "null"],
              format: "email"
            },
            phone_number: {
              type: ["string"],
              minLength: 10,
              maxLength: 15
            },
            alternate_phone: {
              type: ["string", "null"]
            },
            billing_address: { type: ["string", "null"] },
            billing_district: { type: ["string", "null"] },
            billing_state: { type: ["string", "null"] },
            billing_pin: {
              type: ["number", "null"],
              minimum: 100000,
              maximum: 999999
            },
            shipping_address: { type: ["string", "null"] },
            shipping_district: { type: ["string", "null"] },
            shipping_state: { type: ["string", "null"] },
            shipping_pin: {
              type: ["number", "null"],
              minimum: 100000,
              maximum: 999999
            },
            state_code: {
              type: ["string", "null"],
              minLength: 2,
              maxLength: 2
            },
            gstin: {
              type: ["string", "null"],
              minLength: 15,
              maxLength: 15
            },
            notes: {
              type: ["array", "null"],
              items: { type: "string" }
            },
            status: { type: "string" },
            created_by: { type: "string" }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateCustomerBody }>,
      reply: FastifyReply
    ) => {

      cns(request.url, request.body);

      const controller = new CustomerController();

      const customer = await controller.createCustomer(request.body);

      return reply.code(201).send({
        status: "Success",
        message: customer,
      });
    }
  );

  app.post<{ Body: FetchCustomerBody }>(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1 },
            id: { type: "string" },
            company_id: { type: "number" },
            customer_type: { type: "string" },
            search: { type: ["string", "null"] },
            status: { type: "number" }
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: FetchCustomerBody }>,
      reply: FastifyReply
    ) => {

      cns(request.url, request.body);

      const { page = 1, limit = 10, ...filters } = request.body;
      const offset = (page - 1) * limit;

      const controller = new CustomerController();

      const customers = await controller.fetchCustomer({
        offset,
        filters: {
          ...filters,
          page,
          limit,
        },
      });

      return reply.code(200).send(customers);
    }
  );

  app.post<{ Body: EditCustomerBody }>(
    "/edit",
    async (
      request: FastifyRequest<{ Body: EditCustomerBody }>,
      reply: FastifyReply
    ) => {

      cns(request.url, request.body);

      const controller = new CustomerController();

      const customer = await controller.editCustomer(request.body);

      return reply.code(200).send({
        status: "Success",
        message: customer,
      });
    }
  );

  app.post<{ Body: DeleteCustomerBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["r_id", "deleted_by", "company_id"],
          properties: {
            r_id: { type: "string" },
            company_id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: DeleteCustomerBody }>,
      reply: FastifyReply
    ) => {

      cns(request.url, request.body);

      const controller = new CustomerController();

      const customer = await controller.deleteCustomer(request.body);

      return reply.code(200).send({
        status: "Success",
        message: customer,
      });
    }
  );
}