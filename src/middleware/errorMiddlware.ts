// export class AppError extends Error {
//   statusCode: number;

//   constructor(message: string, statusCode: number) {
//     super(message);
//     this.statusCode = statusCode;
//   }
// }
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/AppError";
import { env } from "../utils/env";
import { el } from "../utils/extra";

export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler(
    (error: any, request: FastifyRequest, reply: FastifyReply) => {
      // always log the original error for diagnostics
      el(error);

      let statusCode = 500;
      let message = "Internal Server Error";

      // operational / expected errors
      if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
      } else if (error.validation) {
        // fastify schema validation error
        statusCode = 400;
        message = error.message || "Validation error";
      } else if (error.code && typeof error.code === "string") {
        // likely a database error or other low‑level error
        statusCode = 500;
        message = "Database operation failed";
      }

      const response: any = {
        success: false,
        error: {
          message,
          statusCode,
        },
      };

      if (env.NODE_ENV === "development" && error.stack) {
        response.error.stack = error.stack;
      }

      reply.status(statusCode).send(response);
    }
  );
};