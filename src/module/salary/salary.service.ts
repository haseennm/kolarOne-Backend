import { PoolClient } from "pg";
import { AppError } from "../../utils/AppError";
import { executeInTransaction } from "../../config/db";
import { ConfirmSalaryParams, CreateSalaryParams, GenerateSalaryBody, GetSalaryBody, SalaryGenerationRow } from "./salary.types";
import { getRecord } from "../../utils/extra";

const FULL_DAY_MINUTES = 360;
const HALF_DAY_MINUTES = 210;
const PAID_LEAVE = 2;

export default class SalaryService {
  async generateSalary(
    data: CreateSalaryParams,
    client: PoolClient
  ): Promise<SalaryGenerationRow[]> {

    const {
      from_date,
      to_date,
      entity_id,
      entity_type,
      remark,
      staff_ids,
      salaryMonthStr
    } = data;

    const newRemarksJson = JSON.stringify([remark]);

    // 🔍 Validate staff against entity
    for (const staffId of staff_ids) {
      const staff = await executeInTransaction(
        client,
        `SELECT entity_type, entity_id 
       FROM staff 
       WHERE id = $1 AND status != $2`,
        [staffId, 0]
      );

      if (staff.rowCount === 0) {
        throw new AppError("Staff not found", 404);
      }

      const {
        entity_id: staff_entity_id,
        entity_type: staff_entity_type
      } = staff.rows[0];

      let resolved_entity_id: number;
      let resolved_entity_type: "B" | "C";

      if (staff_entity_type === "B" || staff_entity_type === "C") {
        resolved_entity_id = staff_entity_id;
        resolved_entity_type = staff_entity_type;
      } else if (staff_entity_type === "F") {
        const branchFirm = await executeInTransaction(
          client,
          `SELECT branch_id FROM firm WHERE id = $1 AND status != 0`,
          [staff_entity_id]
        );

        if (branchFirm.rowCount === 0) {
          throw new AppError("Firm not found", 404);
        }

        resolved_entity_id = branchFirm.rows[0].branch_id;
        resolved_entity_type = "B";
      } else {
        throw new AppError("Invalid entity type", 400);
      }

      if (resolved_entity_type !== entity_type) {
        throw new AppError("Entity type mismatch for this staff", 400);
      }

      if (Number(resolved_entity_id) !== Number(entity_id)) {
        throw new AppError("Entity mismatch for this staff", 403);
      }
    }

    // 🧠 Main Salary Calculation Query
    const upsertQuery = `
  INSERT INTO salary_generations (
    staff_id, salary_month, base_salary, total_days, 
    full_days, half_days, holiday_days, absent_days, 
    payable_days, gross_salary, final_salary, 
    entity_id, entity_type, remarks, status
  )
  SELECT 
    res.staff_id, 
    $1 AS salary_month, 
    res.base_salary, 
    res.total_days,
    res.full_days, 
    res.half_days, 
    res.holiday_days, 
    res.absent_days,
    res.payable_days, 
    res.gross_salary, 
    res.gross_salary AS final_salary,
    $2 AS entity_id,
    $3 AS entity_type,
    $4::jsonb AS remarks,
    6 AS status
  FROM (
    WITH calendar AS (
      SELECT gs.dt::date
      FROM generate_series($5::date, $6::date, INTERVAL '1 day') gs(dt)
    ),

    holiday_list AS (
      SELECT DISTINCT attendance_date 
      FROM attendance 
      WHERE staff_id::text = 'HOLIDAY' 
        AND source = 'HOLIDAY' 
        AND entity_id = $2
        AND entity_type = $3
    ),

    daily_attendance AS (
      SELECT 
        staff_id, 
        attendance_date,
        SUM(EXTRACT(EPOCH FROM (out_time - in_time)) / 60)::integer AS minutes_worked
      FROM attendance
      WHERE entity_id = $2
        AND entity_type = $3
        AND attendance_date BETWEEN $5 AND $6
        AND staff_id::text != 'HOLIDAY'
      GROUP BY staff_id, attendance_date
    ),

    staff_calendar AS (
      SELECT 
        s.id AS staff_id, 
        s.salary AS base_salary, 
        c.dt,
        CASE 
          WHEN EXTRACT(DOW FROM c.dt) = 0 
               OR h.attendance_date IS NOT NULL THEN 'HOLIDAY'
          WHEN COALESCE(a.minutes_worked, 0) >= $7 THEN 'FULL'
          WHEN COALESCE(a.minutes_worked, 0) >= $8 THEN 'HALF'
          ELSE 'ABSENT'
        END AS day_type
      FROM staff s
      CROSS JOIN calendar c
      LEFT JOIN holiday_list h ON c.dt = h.attendance_date
      LEFT JOIN daily_attendance a 
        ON s.id::text = a.staff_id AND c.dt = a.attendance_date
      WHERE (
        (s.entity_type = 'B' AND s.entity_id = $2 AND $3 = 'B')
        OR
        (s.entity_type = 'C' AND s.entity_id = $2 AND $3 = 'C')
        OR
        (s.entity_type = 'F' AND $3 = 'B' AND EXISTS (
          SELECT 1 FROM firm f 
          WHERE f.id = s.entity_id AND f.branch_id = $2
        ))
      )
      AND s.id = ANY($9::uuid[])
      AND s.status = 1
    ),

    ranked_leaves AS (
      SELECT *,
        CASE 
          WHEN day_type = 'ABSENT' 
          THEN ROW_NUMBER() OVER(PARTITION BY staff_id ORDER BY dt)
          ELSE 0 
        END AS absent_seq
      FROM staff_calendar
    )

    SELECT 
      staff_id,
      MAX(base_salary) AS base_salary,
      COUNT(*) AS total_days,

      COUNT(*) FILTER (WHERE day_type = 'FULL')    AS full_days,
      COUNT(*) FILTER (WHERE day_type = 'HALF')    AS half_days,
      COUNT(*) FILTER (WHERE day_type = 'HOLIDAY') AS holiday_days,
      COUNT(*) FILTER (WHERE day_type = 'ABSENT')  AS absent_days,

      (
        COUNT(*) FILTER (WHERE day_type = 'FULL') +
        COUNT(*) FILTER (WHERE day_type = 'HALF') * 0.5 +
        COUNT(*) FILTER (WHERE day_type = 'HOLIDAY') +
        LEAST(
          COUNT(*) FILTER (WHERE day_type = 'ABSENT'),
          $10::numeric
        )
      )::numeric(5,2) AS payable_days,

      (MAX(base_salary) / NULLIF(COUNT(*), 0)) * (
        COUNT(*) FILTER (WHERE day_type = 'FULL') +
        COUNT(*) FILTER (WHERE day_type = 'HALF') * 0.5 +
        COUNT(*) FILTER (WHERE day_type = 'HOLIDAY') +
        LEAST(
          COUNT(*) FILTER (WHERE day_type = 'ABSENT'),
          $10::numeric
        )
      ) AS gross_salary

    FROM ranked_leaves
    GROUP BY staff_id
  ) res

  ON CONFLICT (staff_id, salary_month, entity_id, entity_type)
  DO UPDATE SET
    base_salary  = CASE WHEN salary_generations.status != 6 THEN salary_generations.base_salary   ELSE EXCLUDED.base_salary   END,
    total_days   = CASE WHEN salary_generations.status != 6 THEN salary_generations.total_days    ELSE EXCLUDED.total_days    END,
    full_days    = CASE WHEN salary_generations.status != 6 THEN salary_generations.full_days     ELSE EXCLUDED.full_days     END,
    half_days    = CASE WHEN salary_generations.status != 6 THEN salary_generations.half_days     ELSE EXCLUDED.half_days     END,
    absent_days  = CASE WHEN salary_generations.status != 6 THEN salary_generations.absent_days   ELSE EXCLUDED.absent_days   END,
    holiday_days = CASE WHEN salary_generations.status != 6 THEN salary_generations.holiday_days  ELSE EXCLUDED.holiday_days  END,
    payable_days = CASE WHEN salary_generations.status != 6 THEN salary_generations.payable_days  ELSE EXCLUDED.payable_days  END,
    gross_salary = CASE WHEN salary_generations.status != 6 THEN salary_generations.gross_salary  ELSE EXCLUDED.gross_salary  END,
    final_salary = CASE WHEN salary_generations.status != 6 THEN salary_generations.final_salary  ELSE EXCLUDED.final_salary  END,
    remarks      = CASE 
                     WHEN salary_generations.status != 6 
                     THEN salary_generations.remarks 
                     ELSE salary_generations.remarks || EXCLUDED.remarks 
                   END
  RETURNING *;
  `;

    const params = [
      salaryMonthStr,   // $1
      entity_id,        // $2
      entity_type,      // $3
      newRemarksJson,   // $4
      from_date,        // $5
      to_date,          // $6
      FULL_DAY_MINUTES, // $7
      HALF_DAY_MINUTES, // $8
      staff_ids,        // $9
      PAID_LEAVE        // $10
    ];

    await executeInTransaction(client, upsertQuery, params);

    // 📤 Fetch result
    const fetchQuery = `
    SELECT sg.*, s.full_name 
    FROM salary_generations sg
    JOIN staff s ON sg.staff_id = s.id
    WHERE sg.salary_month = $1 
      AND sg.entity_id = $2 
      AND sg.entity_type = $3
      AND sg.staff_id = ANY($4)
  `;

    const fetchResult = await executeInTransaction(client, fetchQuery, [
      salaryMonthStr,
      entity_id,
      entity_type,
      staff_ids,
    ]);

    return fetchResult.rows as SalaryGenerationRow[];
  }
  async confirmSalary(data: ConfirmSalaryParams, client: any) {

  const { r_id, entity_id, entity_type, final_salary, remark, statusCode } = data;

  // ✅ Check salary record based on entity
  const is_salary_exist = await executeInTransaction(
    client,
    `
    SELECT * FROM salary_generations
    WHERE id = $1
      AND entity_id = $2
      AND entity_type = $3
    `,
    [r_id, entity_id, entity_type]
  );

  if (is_salary_exist.rowCount === 0) {
    throw new AppError("Salary not found", 404);
  }

  const salary = is_salary_exist.rows[0];

  // ❌ Already paid
  if (salary.status === 5) {
    throw new AppError(
      "This record cannot be modified because it has already been paid.",
      409
    );
  }

  // ✅ Keep old status if 99
  const status =
    statusCode === 99
      ? salary.status
      : statusCode;

  // ✅ Adjustment calculation
  const adjustment =
    (final_salary ?? salary.final_salary) - salary.gross_salary;

  const updateQuery = `
    UPDATE salary_generations
    SET
      final_salary = $1,
      status = $2,
      remarks = CASE
        WHEN remarks IS NULL THEN $3::jsonb
        WHEN jsonb_typeof(remarks) = 'array'
          THEN remarks || $3::jsonb
        ELSE jsonb_build_array(remarks) || $3::jsonb
      END,
      adjustments = $4
    WHERE id = $5
      AND entity_id = $6
      AND entity_type = $7
    RETURNING *;
  `;

  const values = [
    final_salary ?? salary.final_salary,
    status,
    JSON.stringify(remark),
    adjustment,
    r_id,
    entity_id,
    entity_type
  ];

  const { rows } = await executeInTransaction(client, updateQuery, values);

  return {
    data: rows[0]
  };
}
  async getSalary(
    data: GetSalaryBody,
    client: PoolClient
  ): Promise<SalaryGenerationRow[]> {

    const { salary_month, entity_id, entity_type, staff_ids } = data;

    let query = `
    SELECT 
      sg.*,
      s.full_name
    FROM salary_generations sg
    JOIN staff s ON sg.staff_id = s.id
    WHERE sg.salary_month = $1
      AND sg.entity_id = $2
      AND sg.entity_type = $3
  `;

    const params: any[] = [salary_month, entity_id, entity_type];

    // Optional filter by staff_ids
    if (staff_ids && staff_ids.length > 0) {
      query += ` AND sg.staff_id = ANY($4)`;
      params.push(staff_ids);
    }

    query += ` ORDER BY s.full_name ASC`;

    const result = await executeInTransaction(client, query, params);

    return result.rows as SalaryGenerationRow[];
  }
}