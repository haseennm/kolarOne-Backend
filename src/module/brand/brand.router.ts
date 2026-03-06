import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import BrandController from "./brand.controller";
import {
  CreateBrandBody,
  EditBrandBody,
  DeleteBrandBody,
  FetchBrandBody,
} from "./brand.types";
import { cns } from "../../utils/extra";

export async function brandRouter(app: FastifyInstance): Promise<void> {


  app.post<{ Body: CreateBrandBody }>(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "created_by", "company_id"],
          properties: {
            name: { type: "string" },
            company_id: { type: "number" },
            created_by: { type: "string" },
            status: { type: "string" },
            note: { type: ["string", "null"] },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBrandBody }>, reply: FastifyReply) => {
      cns(request.url, request.body)
      const body = request.body;

      const controller = new BrandController();
      const result = await controller.createBrand({
        name: body.name.trim(),
        created_by: body.created_by,
        status: body.status ?? "Active",
        note: body.note ?? null,
        company_id: body.company_id
      });

      return reply.code(201).send({
        status: "Success",
        message: result,
      });
    }
  );

  app.post(
    "/get",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1 },
            id: { type: "number" },
            company_id: { type: "number" },
            status: { type: "string" },
            search: { type: ["string", "null"] },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {

      const { page = 1, limit = 10, ...filters } = request.body as FetchBrandBody;
      const offset = (page - 1) * limit;

      const controller = new BrandController();

      const brands = await controller.fetchBrand({
        offset,
        filters: {
          ...filters,
          page,
          limit,
        },
      });

      return reply.code(200).send(brands);
    }
  );

  app.post<{ Body: EditBrandBody }>(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "updated_by"],
          properties: {
            id: { type: "number" },
            name: { type: "string" },
            status: { type: "string" },
            note: { type: ["string", "null"] },
            updated_by: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: EditBrandBody }>, reply: FastifyReply) => {

      const body = request.body;

      const controller = new BrandController();
      const result = await controller.editBrand({
        ...body,
      });

      return reply.code(200).send({
        status: "Success",
        message: result,
      });
    }
  );

 app.post<{ Body: DeleteBrandBody }>(
    "/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["id", "deleted_by"],
          properties: {
            id: { type: "number" },
            deleted_by: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: DeleteBrandBody }>, reply: FastifyReply) => {

      const controller = new BrandController();
      const result = await controller.deleteBrand(request.body);

      return reply.code(200).send({
        status: "Success",
        message: result,
      });
    }
  );
}