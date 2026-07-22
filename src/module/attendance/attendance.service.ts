import { PoolClient } from "pg";
import { executeInTransaction, transaction } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { AttendanceRow, DailyAttendanceRow, DeleteHoliday, HolidayEntry, HolidayListItem, MarkHolidayBody, MonthlyStaffSummary, StaffRow } from "./attendance.types";
import { getRecord, isFutureDay } from "../../utils/extra";

export default class AttendanceService {

  async fingerprintAttendance(
    fingerprint_id: string,
    entity_id_input: number,
    today: string,
    entity_type_input: "B" | "C",
    client: any
  ) {
    // 🔍 Fetch staff
    const staff = await executeInTransaction<StaffRow>(
      client,
      `
    SELECT id, full_name, entity_id, entity_type
    FROM staff
    WHERE finger_id = $1
    AND status != $2
    `,
      [fingerprint_id, 0]
    );

    if (staff.rows.length === 0) {
      throw new AppError("Cannot find staff with this fingerprint", 404);
    }

    const staffData = staff.rows[0];
    const staff_id = staffData.id;
    const staff_name = staffData.full_name;
    const staff_entity_type = staffData.entity_type;
    const staff_entity_id = staffData.entity_id;

    let resolved_entity_id: number;
    let resolved_entity_type: "B" | "C";

    if (staff_entity_type === "B" || staff_entity_type === "C") {
      resolved_entity_id = staff_entity_id;
      resolved_entity_type = staff_entity_type;
    } else if (staff_entity_type === "F") {
      const branchFirm = await executeInTransaction(
        client,
        `
      SELECT branch_id
      FROM firm
      WHERE id = $1 AND status != 0
      `,
        [staff_entity_id]
      );

      if (branchFirm.rowCount === 0) {
        throw new AppError("Firm not found", 404);
      }

      resolved_entity_id = branchFirm.rows[0].branch_id;
      resolved_entity_type = "B";
    } else {
      throw new AppError("Invalid entity type for fingerprint attendance", 400);
    }

    if (resolved_entity_type !== entity_type_input) {
      throw new AppError("Entity type mismatch for this staff", 400);
    }

    if (resolved_entity_id !== entity_id_input) {
      throw new AppError("Entity ID mismatch for this staff", 403);
    }

    const attendance = await executeInTransaction<AttendanceRow>(
      client,
      `
    SELECT id, in_time, out_time
    FROM attendance
    WHERE staff_id = $1
    AND attendance_date = $2
    AND entity_id = $3
    AND entity_type = $4
    LIMIT 1
    `,
      [staff_id, today, resolved_entity_id, resolved_entity_type]
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
        entity_id,
        created_by,
        entity_type
      )
      VALUES ($1, $2, NOW(), 'FINGERPRINT', $3, $4, $5)
      `,
        [
          staff_id,
          today,
          resolved_entity_id,
          staff_id,
          resolved_entity_type
        ]
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
      AND entity_id = $3
      AND entity_type = $4
      `,
        [
          attendance.rows[0].id,
          staff_id,
          resolved_entity_id,
          resolved_entity_type
        ]
      );

      return { msg: `${staff_name} Check OUT` };
    }

    throw new AppError("Attendance already completed for today", 400);
  }
  async manualAttendance(
    staff_id: string,
    entity_id_input: number,
    today: string,
    entity_type_input: string,
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

    if (staff.rows.length === 0) {
      throw new AppError("Staff not found", 404);
    }

    const staffData = staff.rows[0];
    const staff_name = staffData.full_name;
    const staff_entity_type = staffData.entity_type;
    const staff_entity_id = staffData.entity_id;
    let staff_entity_type_debug = staffData.entity_type
    if (staffData.entity_type === "F") staff_entity_type_debug = "B"
    if (staff_entity_type_debug !== entity_type_input) {
      throw new AppError("Entity type does not match this staff", 400);
    }

    let resolved_entity_id: number;

    if (staff_entity_type === "B" || staff_entity_type === "C") {
      resolved_entity_id = staff_entity_id;
    } else if (staff_entity_type === "F") {
      const branchFirm = await executeInTransaction(
        client,
        `
      SELECT branch_id
      FROM firm
      WHERE id = $1 AND status != 0
      `,
        [staff_entity_id]
      );

      if (branchFirm.rowCount === 0) {
        throw new AppError("Firm not found", 404);
      }
      resolved_entity_id = branchFirm.rows[0].branch_id;
    } else {
      throw new AppError("Invalid entity type for staff", 400);
    }
    if (Number(resolved_entity_id) !== Number(entity_id_input)) {
      throw new AppError("Entity ID mismatch for this staff", 403);
    }

    const attendance = await executeInTransaction<AttendanceRow>(
      client,
      `
    SELECT id, in_time, out_time
    FROM attendance
    WHERE staff_id = $1
    AND attendance_date = $2
    AND entity_id = $3
    AND entity_type = $4
    LIMIT 1
    `,
      [staff_id, today, resolved_entity_id, entity_type_input]
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
        entity_id,
        created_by,
        entity_type
      )
      VALUES ($1, $2, NOW(), 'MANUAL', $3, $4, $5)
      `,
        [staff_id, today, resolved_entity_id, staff_id, entity_type_input]
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
      AND entity_id = $3
      AND entity_type = $4
      `,
        [
          attendance.rows[0].id,
          staff_id,
          resolved_entity_id,
          entity_type_input
        ]
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
    const { branch_id, company_id, created_by, description } = data;


    let entity_id: number;
    let entity_type: "B" | "C";

    // ✅ Resolve entity
    if (branch_id) {
      const is_branch_exist = await getRecord(
        branch_id,
        "branches",
        "company_id",
        company_id,
        client
      );

      if (!is_branch_exist) {
        throw new AppError("Branch not found or deleted", 404);
      }

      entity_id = branch_id;
      entity_type = "B";
    } else {
      const is_company_exist = await getRecord(
        company_id,
        "company",
        "id",
        company_id,
        client
      );

      if (!is_company_exist) {
        throw new AppError("Company not found or deleted", 404);
      }

      entity_id = company_id!;
      entity_type = "C";
    }

    // ✅ Insert holiday
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
      entity_id,
      entity_type,
      created_by,
      note
    )
    VALUES
    (
      'HOLIDAY',
      $1,
      NULL,
      NULL,
      'HOLIDAY',
      $2,
      $3,
      $4,
      $5
    )
    `,
      [
        holidayDate,
        entity_id,
        entity_type,
        created_by,
        description ?? null
      ]
    );

    return `Holiday marked on ${holidayDate}`;
  }
  async getHolidayList(
    entity_id: number,
    entity_type: string,
    client: PoolClient
  ): Promise<HolidayListItem[]> {
    const result = await executeInTransaction<HolidayListItem>(
      client,
      `
    SELECT 
      id, 
      attendance_date, 
      note
    FROM attendance
    WHERE entity_id = $1
      AND entity_type = $2
      AND source = 'HOLIDAY'
    ORDER BY attendance_date DESC
    `,
      [entity_id, entity_type]
    );

    return result.rows;
  }
  //   async getDailyAttendance(branch_id: number, date: string, client: PoolClient): Promise<DailyAttendanceRow[]> {

  //     const result = await executeInTransaction<DailyAttendanceRow>(
  //       client,
  //       `
  //       WITH attendance_calc AS (
  //         SELECT
  //           staff_id,
  //           attendance_date,
  //           SUM(
  //             CASE
  //               WHEN out_time IS NOT NULL THEN EXTRACT(EPOCH FROM (out_time - in_time)) / 60
  //               WHEN cnt = 1 THEN 300
  //               ELSE 60
  //             END
  //           )::integer AS total_minutes
  //         FROM (
  //           SELECT
  //             staff_id,
  //             attendance_date,
  //             in_time,
  //             out_time,
  //             COUNT(*) OVER (PARTITION BY staff_id, attendance_date) AS cnt
  //           FROM attendance
  //           WHERE attendance_date = $1
  //             AND branch_id = $2
  //             AND staff_id != 'HOLIDAY'
  //         ) x
  //         GROUP BY staff_id, attendance_date
  //       )

  //       SELECT
  //         s.id AS staff_id,
  //         s.full_name,
  //         $1 AS attendance_date,
  //         COALESCE(a.total_minutes, 0) AS total_minutes,
  //         CASE
  //           WHEN a.total_minutes IS NULL OR a.total_minutes < 210 THEN 'Absent'
  //           WHEN a.total_minutes < 360 THEN 'HalfDay'
  //           ELSE 'FullDay'
  //         END AS status
  //      FROM staff s
  // LEFT JOIN attendance_calc a ON a.staff_id = s.id::text
  // WHERE (
  //     (s.entity_type = 'B' AND s.entity_id = $2)
  //     OR
  //     (s.entity_type = 'F' AND EXISTS (
  //         SELECT 1 FROM firm f
  //         WHERE f.id = s.entity_id
  //           AND f.branch_id = $2
  //     ))
  // )
  // ORDER BY s.id;
  //       `,
  //       [date, branch_id]
  //     );

  //     return result.rows;
  //   }
  async getDailyAttendance(
    entity_id: number,
    entity_type: "B" | "C",
    date: string,
    client: PoolClient
  ): Promise<DailyAttendanceRow[]> {

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
          AND entity_id = $2
          AND entity_type = $3
          AND source != 'HOLIDAY'
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

    LEFT JOIN attendance_calc a 
      ON a.staff_id = s.id::text

    WHERE (
      -- ✅ Direct match (Branch or Company)
      (s.entity_type = $3 AND s.entity_id = $2)

      OR

      -- ✅ Firm → Branch mapping (only applies when entity_type = 'B')
      ($3 = 'B' AND s.entity_type = 'F' AND EXISTS (
        SELECT 1 FROM firm f
        WHERE f.id = s.entity_id
          AND f.branch_id = $2
      ))
    )

    ORDER BY s.id;
    `,
      [date, entity_id, entity_type]
    );

    return result.rows;
  }
  //   async getMonthlyAttendance(
  //     branch_id: number,
  //     from_date: string,
  //     to_date: string,
  //     client: PoolClient
  //   ): Promise<{
  //     attendanceData: MonthlyStaffSummary[];
  //     holidays: HolidayEntry[];
  //   }> {

  //     const attResult = await executeInTransaction<MonthlyStaffSummary>(
  //       client,
  //       `
  //     WITH RECURSIVE dates AS (
  //   SELECT $1::date AS dt
  //   UNION ALL
  //   SELECT (dt + INTERVAL '1 day')::date AS dt 
  //   FROM dates
  //   WHERE dt < $2::date
  // ),
  //       attendance_calc AS (
  //         SELECT 
  //           staff_id,
  //           attendance_date,
  //           SUM(
  //             CASE
  //               WHEN out_time IS NOT NULL
  //                 THEN EXTRACT(EPOCH FROM (out_time - in_time)) / 60
  //               WHEN cnt = 1 THEN 300
  //               ELSE 60
  //             END
  //           )::integer AS worked_minutes
  //         FROM (
  //           SELECT
  //             staff_id,
  //             attendance_date,
  //             in_time,
  //             out_time,
  //             COUNT(*) OVER (PARTITION BY staff_id, attendance_date) AS cnt
  //           FROM attendance
  //           WHERE branch_id = $3
  //             AND staff_id != 'HOLIDAY'
  //         ) x
  //         GROUP BY staff_id, attendance_date
  //       ),

  //       holiday_dates AS (
  //         SELECT DISTINCT attendance_date AS dt
  //         FROM attendance
  //         WHERE branch_id = $3
  //           AND staff_id = 'HOLIDAY'
  //       ),

  //       working_dates AS (
  //         SELECT dt
  //         FROM dates
  //         WHERE dt NOT IN (SELECT dt FROM holiday_dates)
  //       )

  //       SELECT
  //         s.id AS staff_id,
  //         s.full_name,
  //         COUNT(wd.dt) AS total_days,
  //         COALESCE(SUM(a.worked_minutes), 0) AS total_minutes,
  //         ROUND(COALESCE(SUM(a.worked_minutes), 0)::numeric / 60, 2) AS total_hours,
  //         SUM(CASE WHEN a.worked_minutes >= 360 THEN 1 ELSE 0 END) AS full_days,
  //         SUM(CASE WHEN a.worked_minutes BETWEEN 181 AND 359 THEN 1 ELSE 0 END) AS half_days,
  //         SUM(CASE WHEN a.worked_minutes IS NULL THEN 1 ELSE 0 END) AS absent_days
  //      FROM staff s
  // CROSS JOIN working_dates wd
  // LEFT JOIN attendance_calc a
  //   ON a.staff_id = s.id::text
  //  AND a.attendance_date = wd.dt
  // WHERE (
  //     (s.entity_type = 'B' AND s.entity_id = $3)
  //     OR
  //     (s.entity_type = 'F' AND EXISTS (
  //         SELECT 1 FROM firm f
  //         WHERE f.id = s.entity_id
  //           AND f.branch_id = $3
  //     ))
  // )
  // GROUP BY s.id, s.full_name
  // ORDER BY s.full_name;
  //       `,
  //       [from_date, to_date, branch_id]
  //     );

  //     const holidayResult = await executeInTransaction<HolidayEntry>(
  //       client,
  //       `
  //       SELECT 
  //         TO_CHAR(attendance_date, 'DD-MM-YYYY Day') AS holiday,
  //         attendance_date::text AS attendance_date
  //       FROM attendance
  //       WHERE branch_id = $1
  //         AND staff_id = 'HOLIDAY'
  //         AND attendance_date BETWEEN $2 AND $3
  //       ORDER BY attendance_date;
  //       `,
  //       [branch_id, from_date, to_date]
  //     );

  //     return {
  //       attendanceData: attResult.rows,
  //       holidays: holidayResult.rows
  //     };
  //   }
  async getMonthlyAttendance(
    entity_id: number,
    entity_type: "B" | "C",
    from_date: string,
    to_date: string,
    client: PoolClient
  ): Promise<{
    attendanceData: MonthlyStaffSummary[];
    holidays: HolidayEntry[];
  }> {

    const attResult = await executeInTransaction<MonthlyStaffSummary>(
      client,
      `
    WITH RECURSIVE dates AS (
      SELECT $1::date AS dt
      UNION ALL
      SELECT (dt + INTERVAL '1 day')::date
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
        WHERE entity_id = $3
          AND entity_type = $4
          AND source != 'HOLIDAY'
      ) x
      GROUP BY staff_id, attendance_date
    ),

    holiday_dates AS (
      SELECT DISTINCT attendance_date AS dt
      FROM attendance
      WHERE entity_id = $3
        AND entity_type = $4
        AND source = 'HOLIDAY'
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
      -- ✅ Direct match (B or C)
      (s.entity_type = $4 AND s.entity_id = $3)

      OR

      -- ✅ Firm → Branch mapping (only for branch view)
      ($4 = 'B' AND s.entity_type = 'F' AND EXISTS (
        SELECT 1 FROM firm f
        WHERE f.id = s.entity_id
          AND f.branch_id = $3
      ))
    )

    GROUP BY s.id, s.full_name
    ORDER BY s.full_name;
    `,
      [from_date, to_date, entity_id, entity_type]
    );

    // ✅ Holiday list
    const holidayResult = await executeInTransaction<HolidayEntry>(
      client,
      `
    SELECT 
      TO_CHAR(attendance_date, 'DD-MM-YYYY Day') AS holiday,
      attendance_date::text AS attendance_date
    FROM attendance
    WHERE entity_id = $1
      AND entity_type = $2
      AND source = 'HOLIDAY'
      AND attendance_date BETWEEN $3 AND $4
    ORDER BY attendance_date;
    `,
      [entity_id, entity_type, from_date, to_date]
    );

    return {
      attendanceData: attResult.rows,
      holidays: holidayResult.rows
    };
  }
  async deleteHoliday(
    data: DeleteHoliday,
    client: PoolClient
  ) {
    const { r_id, branch_id, company_id } = data;



    let entity_id: number;
    let entity_type: "B" | "C";

    if (branch_id) {
      entity_id = branch_id;
      entity_type = "B";
    } else {
      entity_id = company_id!;
      entity_type = "C";
    }

    // 🔍 First fetch the record (before delete!)
    const existing = await executeInTransaction(
      client,
      `
    SELECT attendance_date
    FROM attendance
    WHERE id = $1
      AND entity_id = $2
      AND entity_type = $3
      AND source = 'HOLIDAY'
    LIMIT 1
    `,
      [r_id, entity_id, entity_type]
    );

    if (existing.rowCount === 0) {
      throw new AppError("Holiday record not found, or not valid", 404);
    }

    const holidayDate = existing.rows[0].attendance_date;

    // ❗ Validate BEFORE delete
    if (!isFutureDay(holidayDate)) {
      throw new AppError(
        "Cannot modify past or current day holidays",
        403
      );
    }

    await executeInTransaction(
      client,
      `
    DELETE FROM attendance
    WHERE id = $1
      AND entity_id = $2
      AND entity_type = $3
      AND source = 'HOLIDAY'
    `,
      [r_id, entity_id, entity_type]
    );

    const formattedDate = new Date(holidayDate).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    return `Holiday cancelled: ${formattedDate} is now a working day.`;
  }
}