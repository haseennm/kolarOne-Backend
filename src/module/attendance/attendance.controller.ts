import { transaction } from "../../config/db";
import { isValidDay } from "../../utils/extra";
import AttendanceService from "./attendance.service";
import { DailyAttendanceBody, DeleteHoliday, FingerprintAttendanceBody, HolidayListBody, ManualAttendanceBody, MarkHolidayBody, MonthlyAttendanceBody } from "./attendance.types";

export default class AttendanceController {

  async fingerprintAttendance(data: FingerprintAttendanceBody) {

    const { fingerprint_id, branch_id } = data;

    if (!fingerprint_id) {
      throw new Error("fingerprint_id required");
    }

    const today = new Date().toISOString().slice(0, 10);

    return transaction(async (client) => {

      await isValidDay(client, today, branch_id);

      const service = new AttendanceService();

      return service.fingerprintAttendance(
        fingerprint_id,
        branch_id,
        today,
        client
      );
    });
  }
  async manualAttendance(data: ManualAttendanceBody) {

    const { staff_id, branch_id } = data;

    if (!staff_id) {
      throw new Error("staff_id required");
    }

    const today = new Date().toISOString().slice(0, 10);

    return transaction(async (client) => {

      await isValidDay(client, today, branch_id);

      const service = new AttendanceService();

      return service.manualAttendance(
        staff_id,
        branch_id,
        today,
        client
      );
    });
  }
  async markHoliday(data: MarkHolidayBody) {

    const { branch_id, attendance_date, created_by } = data;
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
    const { branch_id } = data;

    return transaction(async (client) => {
      const service = new AttendanceService();
      const holidays = await service.getHolidayList(branch_id, client);

      return { data: holidays };
    });
  }
  async getDailyAttendance(data: DailyAttendanceBody) {
    const { date, branch_id } = data;

    return transaction(async (client) => {
      const service = new AttendanceService();
      const rows = await service.getDailyAttendance(branch_id, date, client);
      return { data: rows };
    });
  }

  async getMonthlyAttendance(data: MonthlyAttendanceBody) {
    const { from_date, to_date, branch_id } = data;

    return transaction(async (client) => {
      const service = new AttendanceService();
      return service.getMonthlyAttendance(branch_id, from_date, to_date, client);
    });
  }
  
 async deleteHoliday(data: DeleteHoliday) {
  return transaction(async (client) => {
    const service = new AttendanceService();
    const message = await service.deleteHoliday(data, client);
    return { message };
  });
}
}