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

// export const registerErrorHandler = (app: FastifyInstance) => {
//   app.setErrorHandler(
//     (error: any, request: FastifyRequest, reply: FastifyReply) => {
//       // always log the original error for diagnostics
//       el(error);

//       let statusCode = 500;
//       let message = "Internal Server Error";

//       // operational / expected errors
//       if (error instanceof AppError) {
//         statusCode = error.statusCode;
//         message = error.message;
//       } else if (error.validation) {
//         // fastify schema validation error
//         statusCode = 400;
//         message = error.message || "Validation error";
//       } else if (error.code && typeof error.code === "string") {
//         // likely a database error or other low‑level error
//         statusCode = 500;
//         message = "Database operation failed";
//       }

//       const response: any = {
//         success: false,
//         error: {
//           message,
//           statusCode,
//         },
//       };

//       if (env.NODE_ENV === "development" && error.stack) {
//         console.log(error.stack)
//       }

//       reply.status(statusCode).send(response);
//     }
//   );
// };
export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler(
    (error: any, request: FastifyRequest, reply: FastifyReply) => {
      // log original error
      el(error);

      let statusCode = 500;
      let message = "Internal Server Error";

      if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
      }

      // ✅ Fastify validation error
      else if (error.validation) {
        statusCode = 400;

        const formattedErrors: Record<string, string> = {};

        for (const err of error.validation) {
          const field =
            err.instancePath?.replace("/", "") || err.params?.missingProperty;

          if (!field) continue;

          if (err.keyword === "enum") {
            formattedErrors[field] =
              `${field} must be one of: ${err.params.allowedValues.join(", ")}`;
          } else if (err.keyword === "required") {
            formattedErrors[field] = `${field} is required`;
          } else {
            formattedErrors[field] = `${field} ${err.message}`;
          }
        }

        return reply.status(statusCode).send({
          success: false,
          error: {
            message: "Validation failed",
            statusCode,
            fields: formattedErrors,
          },
        });
      }

      else if (error.code === "23505") {
        statusCode = 409;

        const constraint_map: Record<string, string> = {
          unique_company_role: "Role",
          uq_branch_code_company: "Branch code",
          branches_username_key: "User name",
          firm_username_key: "User name",
          staff_email_key: "staff email",
          unique_branch_holiday: "Holiday",
        };

        if (error.constraint && constraint_map[error.constraint]) {
          message = `${constraint_map[error.constraint]} already exists`;
        } else {
          message = "Duplicate record already exists";
        }
      }
      else if (error.code && typeof error.code === "string") {
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
        console.log(error.stack);
      }

      reply.status(statusCode).send(response);
    }
  );
};