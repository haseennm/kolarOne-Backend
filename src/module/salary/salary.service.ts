import { PoolClient } from "pg";
import { AppError } from "../../utils/AppError";
import { executeInTransaction } from "../../config/db";
import { ConfirmSalaryParams, CreateSalaryParams, GenerateSalaryBody, GetSalaryBody, SalaryGenerationRow } from "./salary.types";
import { getRecord } from "../../utils/extra";

const FULL_DAY_MINUTES = 360;
const HALF_DAY_MINUTES = 210;
const PAID_LEAVE = 2;

export default class SalaryService {
  async generateSalary(data: CreateSalaryParams, client: PoolClient): Promise<SalaryGenerationRow[]> {
    const { from_date, to_date, branch_id, remark, staff_ids, salaryMonthStr } = data;

    const newRemarksJson = JSON.stringify([remark]);

    const placeholders = staff_ids.map((_, i) => `$${i + 11}`).join(", ");

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

      const { entity_id, entity_type } = staff.rows[0];
      let match_branch_id: number | null = null;

      if (entity_type === "B") {
        match_branch_id = entity_id;
      }

      else if (entity_type === "F") {
        const branchFirm = await executeInTransaction(
          client,
          `SELECT branch_id 
       FROM firm 
       WHERE id = $1 AND status = $2`,
          [entity_id, 0]
        );

        if (branchFirm.rowCount === 0) {
          throw new AppError("Firm not found", 404);
        }

        match_branch_id = branchFirm.rows[0].branch_id;
      }

      if (Number(match_branch_id) !== Number(branch_id)) {
        throw new AppError("Branch mismatch for this staff", 403);
      }
    }
    const upsertQuery = `
  INSERT INTO salary_generations (
    staff_id, salary_month, base_salary, total_days, 
    full_days, half_days, holiday_days, absent_days, 
    payable_days, gross_salary, final_salary, 
    branch_id, remarks, status
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
    $2 AS branch_id, 
    $3::jsonb AS remarks,
    6 AS status
  FROM (
    WITH calendar AS (
      SELECT gs.dt::date
      FROM generate_series($4::date, $5::date, INTERVAL '1 day') gs(dt)
    ),
    holiday_list AS (
      SELECT DISTINCT attendance_date 
      FROM attendance 
      WHERE staff_id::text = 'HOLIDAY' 
        AND source = 'HOLIDAY' 
        AND branch_id = $2
    ),
    daily_attendance AS (
      SELECT 
        staff_id, 
        attendance_date,
        SUM(EXTRACT(EPOCH FROM (out_time - in_time)) / 60)::integer AS minutes_worked
      FROM attendance
      WHERE branch_id = $2 
        AND attendance_date BETWEEN $4 AND $5
        AND staff_id::text != 'HOLIDAY'
      GROUP BY staff_id, attendance_date
    ),
    staff_calendar AS (
      SELECT 
        s.id AS staff_id, 
        s.salary AS base_salary, 
        c.dt,
        CASE 
          WHEN EXTRACT(DOW FROM c.dt) = 0 OR h.attendance_date IS NOT NULL THEN 'HOLIDAY'
          WHEN COALESCE(a.minutes_worked, 0) >= $6 THEN 'FULL'
          WHEN COALESCE(a.minutes_worked, 0) >= $7 THEN 'HALF'
          ELSE 'ABSENT'
        END AS day_type
      FROM staff s
      CROSS JOIN calendar c
      LEFT JOIN holiday_list h ON c.dt = h.attendance_date
      LEFT JOIN daily_attendance a ON s.id::text = a.staff_id AND c.dt = a.attendance_date
      WHERE (
        (s.entity_type = 'B' AND s.entity_id = $2)
        OR
        (s.entity_type = 'F' AND EXISTS (
          SELECT 1 FROM firm f WHERE f.id = s.entity_id AND f.branch_id = $2
        ))
      )
     AND s.id = ANY($8::uuid[])
      AND s.status = 1
    ),
    ranked_leaves AS (
      SELECT *,
        CASE WHEN day_type = 'ABSENT' 
             THEN ROW_NUMBER() OVER(PARTITION BY staff_id ORDER BY dt)
             ELSE 0 
        END AS absent_seq
      FROM staff_calendar
    )
   SELECT 
  staff_id,
  MAX(base_salary) AS base_salary,
  COUNT(*) AS total_days,
  
  COUNT(*) FILTER (WHERE day_type = 'FULL')      AS full_days,
  COUNT(*) FILTER (WHERE day_type = 'HALF')      AS half_days,
  COUNT(*) FILTER (WHERE day_type = 'HOLIDAY')   AS holiday_days,
  
  COUNT(*) FILTER (WHERE day_type = 'ABSENT')    AS absent_days,
  
  (
    COUNT(*) FILTER (WHERE day_type = 'FULL') +
    COUNT(*) FILTER (WHERE day_type = 'HALF')   * 0.5 +
    COUNT(*) FILTER (WHERE day_type = 'HOLIDAY') +
    LEAST(
      COUNT(*) FILTER (WHERE day_type = 'ABSENT'),
      $9::numeric
    )
  )::numeric(5,2) AS payable_days,
  
  (MAX(base_salary) / NULLIF(COUNT(*), 0)) * (
    COUNT(*) FILTER (WHERE day_type = 'FULL') +
    COUNT(*) FILTER (WHERE day_type = 'HALF')   * 0.5 +
    COUNT(*) FILTER (WHERE day_type = 'HOLIDAY') +
    LEAST(
      COUNT(*) FILTER (WHERE day_type = 'ABSENT'),
      $9::numeric
    )
  ) AS gross_salary
  
FROM ranked_leaves
GROUP BY staff_id
  ) res
  ON CONFLICT (staff_id, salary_month)
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
    remarks      = CASE WHEN salary_generations.status != 6 
                        THEN salary_generations.remarks 
                        ELSE salary_generations.remarks || EXCLUDED.remarks 
                   END
  RETURNING *;
`;

    const params = [
      salaryMonthStr,
      branch_id,
      newRemarksJson,
      from_date,
      to_date,
      FULL_DAY_MINUTES,
      HALF_DAY_MINUTES,
      staff_ids,          // passed as array → PostgreSQL will treat it correctly with ANY
      PAID_LEAVE,
    ];

    const upsertResult = await executeInTransaction(client, upsertQuery, params);

    // 5. Fetch final results with names
    const fetchQuery = `
      SELECT sg.*, s.full_name 
      FROM salary_generations sg
      JOIN staff s ON sg.staff_id = s.id
      WHERE sg.salary_month = $1 
        AND sg.branch_id = $2 
        AND sg.staff_id = ANY($3)
    `;

    const fetchResult = await executeInTransaction(client, fetchQuery, [
      salaryMonthStr,
      branch_id,
      staff_ids,
    ]);

    return fetchResult.rows as SalaryGenerationRow[];
  }
  async confirmSalary(data: ConfirmSalaryParams, client: any) {

    const { r_id, branch_id, final_salary, remark, statusCode } = data;
    const branch_exist = await getRecord(
      branch_id, "branches", "id", branch_id, client
    )
    if (!branch_exist) {
      throw new AppError("Branch not found", 404);
    }
    const company_id = branch_exist.company_id
    const is_salary_exist = await getRecord(
      r_id,
      "salary_generations",
      "branch_id",
      branch_id,
      client
    );

    if (!is_salary_exist) {
      throw new AppError("Salary not found", 404);
    }
    if (is_salary_exist.status === 5) {
      throw new AppError("This record cannot be modified because it has already been paid.", 409);
    }

    const status =
      statusCode === 99
        ? is_salary_exist.status
        : statusCode;
    const adjadjustment = final_salary - is_salary_exist.gross_salary
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
    adjustments =$4
        WHERE id = $5
        RETURNING *;
      `;

    const values = [
      final_salary ?? is_salary_exist.final_salary,
      status,
      JSON.stringify(remark),
      adjadjustment,
      r_id
    ];

    const { rows } = await executeInTransaction(client, updateQuery, values);
    return {
      data: rows[0],
      company_id
    };
  }
  async getSalary(
    data: GetSalaryBody,
    client: PoolClient
  ): Promise<SalaryGenerationRow[]> {

    const { salary_month, branch_id, staff_ids } = data;
    let query = `
    SELECT 
      sg.*,
      s.full_name
    FROM salary_generations sg
    JOIN staff s ON sg.staff_id = s.id
    WHERE sg.salary_month = $1
      AND sg.branch_id = $2
  `;

    const params: any[] = [salary_month, branch_id];

    // Optional filter by staff_ids
    if (staff_ids && staff_ids.length > 0) {
      query += ` AND sg.staff_id = ANY($3)`;
      params.push(staff_ids);
    }

    query += ` ORDER BY s.full_name ASC`;

    const result = await executeInTransaction(client, query, params);

    return result.rows as SalaryGenerationRow[];
  }
}