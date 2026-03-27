import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import AttendanceController from "./attendance.controller";
import { DailyAttendanceBody, DeleteHoliday, FingerprintAttendanceBody, HolidayListBody, ManualAttendanceBody, MarkHolidayBody, MonthlyAttendanceBody } from "./attendance.types";

export async function attendanceRouter(app: FastifyInstance) {

  app.post<{ Body: FingerprintAttendanceBody }>(
    "/fingerprint",
    {
      schema: {
        body: {
          type: "object",
          required: ["fingerprint_id", "branch_id"],
          properties: {

            fingerprint_id: {
              type: "string"
            },

            branch_id: {
              type: "number"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: FingerprintAttendanceBody }>,
      reply: FastifyReply
    ) => {

      const controller = new AttendanceController();

      const data = await controller.fingerprintAttendance(request.body);

      return reply.code(200).send({
        status: "Success",
        ...data
      });
    }
  );
  app.post<{ Body: ManualAttendanceBody }>(
    "/manual",
    {
      schema: {
        body: {
          type: "object",
          required: ["staff_id", "branch_id"],
          properties: {

            staff_id: {
              type: "string"
            },

            branch_id: {
              type: "number"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: ManualAttendanceBody }>,
      reply: FastifyReply
    ) => {

      const controller = new AttendanceController();

      const data = await controller.manualAttendance(request.body);

      return reply.code(200).send({
        status: "Success",
        ...data
      });
    }
  );
  app.post<{ Body: MarkHolidayBody }>(
    "/mark/holiday",
    {
      schema: {
        body: {
          type: "object",
          required: ["branch_id", "created_by","company_id"],
          properties: {

            branch_id: {
              type: "number"
            },

            attendance_date: {
              type: "string"
            },

            created_by: {
              type: "string"
            },
            company_id: {
              type: "number"
            },

            description: {
              type: "string"
            }

          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Body: MarkHolidayBody }>,
      reply: FastifyReply
    ) => {

      const controller = new AttendanceController();

      const message = await controller.markHoliday(request.body);

      return reply.code(200).send({
        status: "Success",
        data: {
          msg: message
        }
      });
    }
  );
  app.post<{ Body: HolidayListBody }>(
    "/holiday/list",
    {
      schema: {
        body: {
          type: "object",
          required: ["branch_id"],
          properties: {
            branch_id: { type: "number" }
          }
        }
      },
   
    },
    async (
      request: FastifyRequest<{ Body: HolidayListBody }>,
      reply: FastifyReply
    ) => {
      const controller = new AttendanceController();

      const result = await controller.getHolidayList(request.body);

      return reply.code(200).send({
        status: "Success",
        data: result.data
      });
    }
  );
    // ─── Daily attendance report ───────────────────────────────────────
  app.post<{ Body: DailyAttendanceBody }>(
    "/daily",
    {
      schema: {
        body: {
          type: "object",
          required: ["date", "branch_id"],
          properties: {
            date:       { type: "string", format: "date" },
            branch_id:  { type: "number" }
          }
        }
      }
      // preHandler: [checkClientEquivalentHook]  ← add if needed
    },
    async (request: FastifyRequest<{ Body: DailyAttendanceBody }>, reply) => {
      const controller = new AttendanceController();
      const result = await controller.getDailyAttendance(request.body);
      return reply.code(200).send({
        status: "Success",
        data: result.data
      });
    }
  );

  // ─── Monthly attendance report ─────────────────────────────────────
  app.post<{ Body: MonthlyAttendanceBody }>(
    "/monthly",
    {
      schema: {
        body: {
          type: "object",
          required: ["from_date", "to_date", "branch_id"],
          properties: {
            from_date:  { type: "string", format: "date" },
            to_date:    { type: "string", format: "date" },
            branch_id:  { type: "number" }
          }
        }
      }
      // preHandler: [checkClientEquivalentHook]
    },
    async (request: FastifyRequest<{ Body: MonthlyAttendanceBody }>, reply) => {
      const controller = new AttendanceController();
      const result = await controller.getMonthlyAttendance(request.body);

      const start = new Date(request.body.from_date);
      const end   = new Date(request.body.to_date);
      const total_days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      return reply.code(200).send({
        status: "Success",
        duration: `${request.body.from_date} to ${request.body.to_date}`,
        total_days,
        holidays: result.holidays.map(h => h.holiday),
        data: result.attendanceData
      });
    }
  );

   app.post<{ Body: DeleteHoliday }>(
          '/mark/workday',
          {
              schema: {
                  body: {
                      type: 'object',
                      required: [
                          'r_id',
                          "branch_id"
                      ],
                      properties: {
                          r_id: { type: 'number' },
                          branch_id: { type: 'number' },
                      },
                  },
              },
          },
          async (request, reply) => {
              const controller = new AttendanceController()
              const branch = await controller.deleteHoliday(request.body)
              return reply.code(201).send(branch)
  
            
          }
      )
}