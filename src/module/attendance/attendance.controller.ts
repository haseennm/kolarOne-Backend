import { transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { isValidDay } from "../../utils/extra";
import AttendanceService from "./attendance.service";
import { DailyAttendanceBody, DeleteHoliday, FingerprintAttendanceBody, HolidayListBody, ManualAttendanceBody, MarkHolidayBody, MonthlyAttendanceBody } from "./attendance.types";

export default class AttendanceController {

  async fingerprintAttendance(data: FingerprintAttendanceBody) {
    const { fingerprint_id, branch_id, company_id } = data;

    // ✅ Validate fingerprint
    if (!fingerprint_id?.trim()) {
      throw new AppError("fingerprint_id required", 400);
    }

    // ✅ Validate entity input
    if (!branch_id && !company_id) {
      throw new AppError("Either branch_id or company_id must be provided.", 400);
    }

    if (branch_id && company_id) {
      throw new AppError("Provide either branch_id or company_id, not both.", 400);
    }

    const today = new Date().toISOString().slice(0, 10);

    // ✅ Resolve entity safely (fix for TS issue)
    let entity_id: number;
    let entity_type: "B" | "C";

    if (branch_id) {
      entity_id = branch_id;
      entity_type = "B";
    } else {
      entity_id = company_id!;
      entity_type = "C";
    }

    return transaction(async (client) => {
      await isValidDay(client, today, entity_id, entity_type);

      const service = new AttendanceService();

      return service.fingerprintAttendance(
        fingerprint_id,
        entity_id,
        today,
        entity_type,
        client
      );
    });
  }
  async manualAttendance(data: ManualAttendanceBody) {

    const { staff_id, branch_id, company_id } = data;

    if (!staff_id) {
      throw new AppError("staff_id required", 400);
    }
    if (!branch_id && !company_id) {
      throw new AppError("Either branch_id or company_id must be provided.", 400);
    }

    if (branch_id && company_id) {
      throw new AppError("Provide either branch_id or company_id, not both.", 400);
    }
    const today = new Date().toISOString().slice(0, 10);
    let entity_id: number;
    let entity_type: "B" | "C";

    if (branch_id) {
      entity_id = branch_id;
      entity_type = "B";
    } else {
      entity_id = company_id!;
      entity_type = "C";
    }

    return transaction(async (client) => {
      await isValidDay(client, today, entity_id, entity_type);

      const service = new AttendanceService();

      return service.manualAttendance(
        staff_id,
        entity_id,
        today,
        entity_type,
        client
      );
    });
  }
  async markHoliday(data: MarkHolidayBody) {

    const { branch_id, attendance_date, company_id } = data;
    if (!branch_id && !company_id) {
      throw new AppError("Either branch_id or company_id must be provided.", 400);
    }

    // if (branch_id && company_id) {
    //   throw new AppError("Provide either branch_id or company_id, not both.", 400);
    // }
    const holidayDate =
      attendance_date ??
      new Date(new Date().setDate(new Date().getDate() + 1))
        .toISOString()
        .split("T")[0];

    return transaction(async (client) => {

      const service = new AttendanceService();

      const message = await service.markHoliday(
        data,
        holidayDate,
        client
      );

      return message;
    });
  }
  async getHolidayList(data: HolidayListBody) {
    const { entity_id, entity_type } = data;

    return transaction(async (client) => {
      const service = new AttendanceService();
      const holidays = await service.getHolidayList(entity_id, entity_type, client);

      return { data: holidays };
    });
  }
  async getDailyAttendance(data: DailyAttendanceBody) {
    const { date, entity_id, entity_type } = data;

    return transaction(async (client) => {
      const service = new AttendanceService();
      const rows = await service.getDailyAttendance(entity_id, entity_type, date, client);
      return { data: rows };
    });
  }
  async getMonthlyAttendance(data: MonthlyAttendanceBody) {
    const { from_date, to_date, entity_id, entity_type } = data;
    const from = new Date(from_date);
    const to = new Date(to_date);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new AppError("Invalid date format", 400);
    }
    if (from > to) {
      throw new AppError("from_date cannot be later than to_date", 400);
    }
    return transaction(async (client) => {
      const service = new AttendanceService();
      return service.getMonthlyAttendance(entity_id, entity_type, from_date, to_date, client);
    });
  }
  async deleteHoliday(data: DeleteHoliday) {
    return transaction(async (client) => {
      if (!data.branch_id && !data.company_id) {
        throw new AppError("Either branch_id or company_id must be provided.", 400);
      }

      if (data.branch_id && data.company_id) {
        throw new AppError("Provide either branch_id or company_id, not both.", 400);
      }
      const service = new AttendanceService();
      const message = await service.deleteHoliday(data, client);
      return { message };
    });
  }
}