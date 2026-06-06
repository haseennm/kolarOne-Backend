import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { cns } from "../../utils/extra";
import {
  createAdvanceSchema,
  returnAdvanceSchema,
  payBillSchema,
  createRentSchema,
  PayBillBody,
  CreateRentBody,
  ReturnRentBody,
  returnRentSchema,
  CreateAdvanceBody,
  ReturnAdvanceBody,
  FetchRentQuery,
  FetchAdvanceLedgerQuery,
  fetchRentSchema,
} from "./rent.types";
import { RentController } from "./rent.controller";

export async function rentRouter(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateRentBody }>(
    "/add",
    {
      schema: {
        body: createRentSchema
      }
    },
    async (
      request,
      reply
    ) => {
      cns(request.url, request.body);

      const controller =
        new RentController();

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
  app.post<{ Body: ReturnRentBody }>(
    "/return",
    {
      schema: {
        body: returnRentSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.returnRent(
          request.body
        );

      return reply.send({
        status: "Success",
        message: data
      });
    }
  );
  app.post<{ Body: PayBillBody }>(
    "/payment",
    {
      schema: {
        body: payBillSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.payBill(
          request.body
        );

      return reply.send({
        status: "Success",
        message: data
      });
    }
  );
  app.post<{ Body: CreateAdvanceBody }>(
    "/advance",
    {
      schema: {
        body: createAdvanceSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.createAdvance(
          request.body
        );

      return reply.code(201).send({
        status: "Success",
        message: data
      });
    }
  );
  app.post<{ Body: ReturnAdvanceBody }>(
    "/advance/return",
    {
      schema: {
        body: returnAdvanceSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.returnAdvance(
          request.body
        );

      return reply.send({
        status: "Success",
        message: data
      });
    }
  );
  app.post<{ Body: FetchRentQuery }>(
    "/fetch",
    {
      schema: {
        body: fetchRentSchema
      }
    },
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.fetchRent(
          request.body
        );

      return reply.send({
        status: "Success",
        data
      });
    }
  );
  app.post<{
    Body: { id: string, branch_id: number };
  }>(
    "/get/id",
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.getRentById(
          Number(request.body.id),
          Number(request.body.branch_id)
        );

      return reply.send({
        status: "Success",
        data
      });
    }
  );
  app.post<{
    Body: FetchAdvanceLedgerQuery;
  }>(
    "/advance/fetch",
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.fetchAdvanceLedger(
          request.body
        );

      return reply.send({
        status: "Success",
        data
      });
    }
  );

  // ADvance by id
  app.post<{
    Body: {
      id: number;
      branch_id: number;
    };
  }>(
    "/advance/get/id",
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.getAdvanceLedgerById(
          Number(request.body.id),
          Number(request.body.branch_id)
        );

      return reply.send({
        status: "Success",
        data
      });
    }
  );
  // Dlt 
  app.post<{
    Body: {
      id: number;
      branch_id: number;
    };
  }>(
    "/delete",
    async (
      request,
      reply
    ) => {
      const controller =
        new RentController();

      const data =
        await controller.deleteRent(
          Number(request.body.id),
          Number(request.body.branch_id)
        );

      return reply.send({
        status: "Success",
        message: data
      });
    }
  );
}
