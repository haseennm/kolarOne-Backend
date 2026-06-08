import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { cns } from "../../utils/extra";
import {
  createRentLossSchema,
  CreateRentLossBody,
  payLostBillSchema,
  PayLostBillBody,
  fetchLossRentSchema,
  FetchLossRentParams,
  DeleteLossRentSchema,
  DeleteLossRentBody,
} from "./rentLoss.types";
import { RentLossController } from "./rentLoss.controller";

export async function rentLostRouter(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateRentLossBody }>(
    "/add",
    {
      schema: {
        body: createRentLossSchema
      }
    },
    async (
      request,
      reply
    ) => {
      cns(request.url, request.body);

      const controller =
        new RentLossController();

      const data =
        await controller.createRent(
          request.body
        );

      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );
  app.post<{ Body: PayLostBillBody }>(
    "/payment",
    {
      schema: {
        body: payLostBillSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentLossController();

      const data =
        await controller.payLostBill(
          request.body
        );

      return reply.send({
        status: "Success",
        message: data
      });
    }
  );
  app.post<{ Body: FetchLossRentParams }>(
    "/fetch",
    {
      schema: {
        body: fetchLossRentSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentLossController();

      const data =
        await controller.fetchLossRent(
          request.body
        );

      return reply.send({
        status: "Success",
        data
      });
    }
  );
  // Dlt 
  app.post<{
    Body: DeleteLossRentBody
  }>(
    "/delete",
    {
      schema: {
        body: DeleteLossRentSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentLossController();

      const data =
        await controller.deleteLossRent(request.body
        );

      return reply.send({
        status: "Success",
        message: data
      });
    }
  );
}
