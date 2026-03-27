import { PoolClient } from "pg";
import { executeInTransaction, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { AttendanceRow, DailyAttendanceRow, DeleteHoliday, HolidayEntry, HolidayListItem, MarkHolidayBody, MonthlyStaffSummary, StaffRow } from "./attendance.types";
import { cns, getRecord, isFutureDay } from "../../utils/extra";

export default class AttendanceService {

  async fingerprintAttendance(
    fingerprint_id: string,
    branch_id: number,
    today: string,
    client: any
  ) {

    const staff = await executeInTransaction<StaffRow>(
      client,
      `
      SELECT id,full_name, entity_id,entity_type
      FROM staff
      WHERE finger_id = $1
      AND status != $2
      `,
      [fingerprint_id, 0]
    );
    cns("staff", staff.rows[0])
    if (staff.rows.length === 0) {
      throw new AppError("Cannot find staff with this fingerprint", 404);
    }

    const staff_id = staff.rows[0].id;
    const staff_name = staff.rows[0].full_name;
    const entity_type = staff.rows[0].entity_type;
    const entity_id = staff.rows[0].entity_id;
    let match_branch_id: number | null = null;
    cns("Values", [staff_id, staff_name, entity_type, entity_id])
    if (entity_type === "B") {
      match_branch_id = entity_id;
    }

    if (entity_type === "F") {

      const branchFirm = await executeInTransaction(
        client,
        `
    SELECT branch_id
    FROM firm
    WHERE id = $1
    `,
        [entity_id]
      );

      if (branchFirm.rowCount === 0) {
        throw new AppError("Firm not found", 404);
      }

      cns("branchFirm.rows[0]", branchFirm.rows[0])
      match_branch_id = branchFirm.rows[0].branch_id;
    }

    if (Number(match_branch_id) !== Number(branch_id)) {
      cns("Validate match", [match_branch_id, branch_id])

      throw new AppError("Branch mismatch for this staff", 403);
    }
    const attendance = await executeInTransaction<AttendanceRow>(
      client,
      `
      SELECT id,in_time,out_time
      FROM attendance
      WHERE staff_id = $1
      AND attendance_date = $2
      AND branch_id = $3
      LIMIT 1
      `,
      [staff_id, today, branch_id]
    );

    if (attendance.rows.length === 0) {

      await executeInTransaction(
        client,
        `
        INSERT INTO attendance
        (
          staff_id,
          attendance_date,
          in_time,
          source,
          branch_id,
          created_by
        )
        VALUES ($1,$2,NOW(),'FINGERPRINT',$3,$4)
        `,
        [staff_id, today, branch_id, staff_id]
      );

      return { msg: `${staff_name} Check IN` };
    }

    if (attendance.rows[0].out_time === null) {
      await executeInTransaction(
        client,
        `
        UPDATE attendance
        SET out_time = NOW()
        WHERE id = $1
        AND staff_id = $2
        AND branch_id = $3
        `,
        [attendance.rows[0].id, staff_id, branch_id]
      );
      return { msg: `${staff_name} Check OUT` };

    }

    throw new AppError("Attendance already completed for today", 400);
  }
  async manualAttendance(
    staff_id: string,
    branch_id: number,
    today: string,
    client: any
  ) {

    const staff = await executeInTransaction<StaffRow>(
      client,
      `
      SELECT *
      FROM staff
      WHERE id = $1
      AND status != $2
      `,
      [staff_id, 0]
    );
    cns("staff", staff.rows[0])
    if (staff.rows.length === 0) {
      throw new AppError("Cannot find staff", 404);
    }

    const staff_name = staff.rows[0].full_name;
    const entity_type = staff.rows[0].entity_type;
    const entity_id = staff.rows[0].entity_id;
    let match_branch_id: number | null = null;
    cns("Values", [staff_id, staff_name, entity_type, entity_id])
    if (entity_type === "B") {
      match_branch_id = entity_id;
    }

    if (entity_type === "F") {

      const branchFirm = await executeInTransaction(
        client,
        `
    SELECT branch_id
    FROM firm
    WHERE id = $1
    `,
        [entity_id]
      );

      if (branchFirm.rowCount === 0) {
        throw new AppError("Firm not found", 404);
      }

      cns("branchFirm.rows[0]", branchFirm.rows[0])
      match_branch_id = branchFirm.rows[0].branch_id;
    }

    if (Number(match_branch_id) !== Number(branch_id)) {
      cns("Validate match", [match_branch_id, branch_id])

      throw new AppError("Branch mismatch for this staff", 403);
    }
    const attendance = await executeInTransaction<AttendanceRow>(
      client,
      `
      SELECT id,in_time,out_time
      FROM attendance
      WHERE staff_id = $1
      AND attendance_date = $2
      AND branch_id = $3
      LIMIT 1
      `,
      [staff_id, today, branch_id]
    );

    if (attendance.rows.length === 0) {

      await executeInTransaction(
        client,
        `
        INSERT INTO attendance
        (
          staff_id,
          attendance_date,
          in_time,
          source,
          branch_id,
          created_by
        )
        VALUES ($1,$2,NOW(),'MANUAL',$3,$4)
        `,
        [staff_id, today, branch_id, staff_id]
      );

      return { msg: `${staff_name} Check IN` };
    }

    if (attendance.rows[0].out_time === null) {
      await executeInTransaction(
        client,
        `
        UPDATE attendance
        SET out_time = NOW()
        WHERE id = $1
        AND staff_id = $2
        AND branch_id = $3
        `,
        [attendance.rows[0].id, staff_id, branch_id]
      );
      return { msg: `${staff_name} Check OUT` };

    }

    throw new AppError("Attendance already completed for today", 400);
  }
  async markHoliday(
    data: MarkHolidayBody,
    holidayDate: string,
    client: PoolClient
  ) {

    const { branch_id, created_by, description, company_id } = data;
    const is_branch_exist = await getRecord(branch_id, "branches", "company_id", company_id, client);
    if (!is_branch_exist) {
      throw new AppError("Branch not found or deleted", 404);
    }

    await executeInTransaction(
      client,
      `
      INSERT INTO attendance
      (
        staff_id,
        attendance_date,
        in_time,
        out_time,
        source,
        branch_id,
        created_by,
        note
      )
      VALUES
      (
        'HOLIDAY',
        $1,
        $2,
        $3,
        'HOLIDAY',
        $4,
        $5,
        $6
      )
      `,
      [
        holidayDate,
        null,
        null,
        branch_id,
        created_by,
        description ?? null
      ]
    );

    return `Holiday marked on ${holidayDate}`;
  }
  async getHolidayList(branch_id: number, client: PoolClient): Promise<HolidayListItem[]> {
    const result = await executeInTransaction<HolidayListItem>(
      client,
      `
      SELECT 
        id, 
        attendance_date, 
        note
      FROM attendance
      WHERE branch_id = $1
        AND staff_id = 'HOLIDAY'
        AND source = 'HOLIDAY'
      ORDER BY attendance_date DESC
      `,
      [branch_id]
    );

    return result.rows;
  }
  // ─── Daily attendance report ───────────────────────────────────────
  async getDailyAttendance(branch_id: number, date: string, client: PoolClient): Promise<DailyAttendanceRow[]> {

    const result = await executeInTransaction<DailyAttendanceRow>(
      client,
      `
      WITH attendance_calc AS (
        SELECT
          staff_id,
          attendance_date,
          SUM(
            CASE
              WHEN out_time IS NOT NULL THEN EXTRACT(EPOCH FROM (out_time - in_time)) / 60
              WHEN cnt = 1 THEN 300
              ELSE 60
            END
          )::integer AS total_minutes
        FROM (
          SELECT
            staff_id,
            attendance_date,
            in_time,
            out_time,
            COUNT(*) OVER (PARTITION BY staff_id, attendance_date) AS cnt
          FROM attendance
          WHERE attendance_date = $1
            AND branch_id = $2
            AND staff_id != 'HOLIDAY'
        ) x
        GROUP BY staff_id, attendance_date
      )

      SELECT
        s.id AS staff_id,
        s.full_name,
        $1 AS attendance_date,
        COALESCE(a.total_minutes, 0) AS total_minutes,
        CASE
          WHEN a.total_minutes IS NULL OR a.total_minutes < 210 THEN 'Absent'
          WHEN a.total_minutes < 360 THEN 'HalfDay'
          ELSE 'FullDay'
        END AS status
     FROM staff s
LEFT JOIN attendance_calc a ON a.staff_id = s.id::text
WHERE (
    (s.entity_type = 'B' AND s.entity_id = $2)
    OR
    (s.entity_type = 'F' AND EXISTS (
        SELECT 1 FROM firm f
        WHERE f.id = s.entity_id
          AND f.branch_id = $2
    ))
)
ORDER BY s.id;
      `,
      [date, branch_id]
    );

    return result.rows;
  }

  // ─── Monthly attendance report ─────────────────────────────────────
  async getMonthlyAttendance(
    branch_id: number,
    from_date: string,
    to_date: string,
    client: PoolClient
  ): Promise<{
    attendanceData: MonthlyStaffSummary[];
    holidays: HolidayEntry[];
  }> {

    // 1. Monthly summary
    const attResult = await executeInTransaction<MonthlyStaffSummary>(
      client,
      `
    WITH RECURSIVE dates AS (
  SELECT $1::date AS dt
  UNION ALL
  SELECT (dt + INTERVAL '1 day')::date AS dt 
  FROM dates
  WHERE dt < $2::date
),
      attendance_calc AS (
        SELECT 
          staff_id,
          attendance_date,
          SUM(
            CASE
              WHEN out_time IS NOT NULL
                THEN EXTRACT(EPOCH FROM (out_time - in_time)) / 60
              WHEN cnt = 1 THEN 300
              ELSE 60
            END
          )::integer AS worked_minutes
        FROM (
          SELECT
            staff_id,
            attendance_date,
            in_time,
            out_time,
            COUNT(*) OVER (PARTITION BY staff_id, attendance_date) AS cnt
          FROM attendance
          WHERE branch_id = $3
            AND staff_id != 'HOLIDAY'
        ) x
        GROUP BY staff_id, attendance_date
      ),

      holiday_dates AS (
        SELECT DISTINCT attendance_date AS dt
        FROM attendance
        WHERE branch_id = $3
          AND staff_id = 'HOLIDAY'
      ),

      working_dates AS (
        SELECT dt
        FROM dates
        WHERE dt NOT IN (SELECT dt FROM holiday_dates)
      )

      SELECT
        s.id AS staff_id,
        s.full_name,
        COUNT(wd.dt) AS total_days,
        COALESCE(SUM(a.worked_minutes), 0) AS total_minutes,
        ROUND(COALESCE(SUM(a.worked_minutes), 0)::numeric / 60, 2) AS total_hours,
        SUM(CASE WHEN a.worked_minutes >= 360 THEN 1 ELSE 0 END) AS full_days,
        SUM(CASE WHEN a.worked_minutes BETWEEN 181 AND 359 THEN 1 ELSE 0 END) AS half_days,
        SUM(CASE WHEN a.worked_minutes IS NULL THEN 1 ELSE 0 END) AS absent_days
     FROM staff s
CROSS JOIN working_dates wd
LEFT JOIN attendance_calc a
  ON a.staff_id = s.id::text
 AND a.attendance_date = wd.dt
WHERE (
    (s.entity_type = 'B' AND s.entity_id = $3)
    OR
    (s.entity_type = 'F' AND EXISTS (
        SELECT 1 FROM firm f
        WHERE f.id = s.entity_id
          AND f.branch_id = $3
    ))
)
GROUP BY s.id, s.full_name
ORDER BY s.full_name;
      `,
      [from_date, to_date, branch_id]
    );

    // 2. Holiday list
    const holidayResult = await executeInTransaction<HolidayEntry>(
      client,
      `
      SELECT 
        TO_CHAR(attendance_date, 'DD-MM-YYYY Day') AS holiday,
        attendance_date::text AS attendance_date
      FROM attendance
      WHERE branch_id = $1
        AND staff_id = 'HOLIDAY'
        AND attendance_date BETWEEN $2 AND $3
      ORDER BY attendance_date;
      `,
      [branch_id, from_date, to_date]
    );

    return {
      attendanceData: attResult.rows,
      holidays: holidayResult.rows
    };
  }
async deleteHoliday(data: DeleteHoliday, client: PoolClient) {
  const { r_id, branch_id } = data;

  const deleteResult = await executeInTransaction(
    client,
    `
    DELETE FROM attendance
    WHERE id = $1
      AND branch_id = $2
      AND staff_id = 'HOLIDAY'
      AND source = 'HOLIDAY'
    RETURNING attendance_date
    `,
    [r_id, branch_id]
  );

  if (deleteResult.rowCount === 0) {
    throw new AppError("Holiday record not found, or not valid", 404);
  }

  const deletedDate = deleteResult.rows[0].attendance_date;
  if (!isFutureDay(deletedDate))throw new AppError("Cannot modify past or current day holidays", 403);
// Assuming holidayDate is a Date or string like '2026-03-14'
const formattedDate = new Date(deletedDate).toLocaleDateString('en-IN', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

return `Holiday cancelled: ${formattedDate} is now a working day.`;
}
}