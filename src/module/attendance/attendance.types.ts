export interface FingerprintAttendanceBody {
  fingerprint_id: string;
  branch_id: number;
}
export interface ManualAttendanceBody {
  staff_id: string;
  branch_id: number;
}

export interface StaffRow {
  id: number;
  full_name: string;
  entity_id:number
  entity_type:string
}

export interface AttendanceRow {
  id: number;
  in_time: string | null;
  out_time: string | null;
}

export interface MarkHolidayBody {
  branch_id: number;
  attendance_date?: string;
  created_by: number;
  description?: string;
  company_id:number
}

export interface HolidayListBody {
  branch_id: number;     // assuming this is company_id or global branch_id
}

export interface HolidayListItem {
  id: number;
  attendance_date: string;
  note: string | null;
}

export interface HolidayListResponse {
  status: "Success";
  data: HolidayListItem[];
}

export interface DailyAttendanceBody {
  date: string;       // YYYY-MM-DD
  branch_id: number;
}

export interface DailyAttendanceRow {
  staff_id: string;
  full_name: string;
  attendance_date: string;
  total_minutes: number;
  status: 'Absent' | 'HalfDay' | 'FullDay';
}

// Monthly attendance report
export interface MonthlyAttendanceBody {
  from_date: string;   // YYYY-MM-DD
  to_date: string;     // YYYY-MM-DD
  branch_id: number;
}

export interface MonthlyStaffSummary {
  staff_id: string;
  full_name: string;
  total_days: number;
  total_minutes: number;
  total_hours: number;
  full_days: number;
  half_days: number;
  absent_days: number;
}

export interface HolidayEntry {
  holiday: string;          // e.g. "15-03-2025 Saturday"
  attendance_date: string;  // YYYY-MM-DD
}

export interface MonthlyAttendanceResponse {
  duration: string;
  total_days: number;
  holidays: string[];           // formatted holiday strings
  data: MonthlyStaffSummary[];
}
export interface DeleteHoliday{
  branch_id: number;
  r_id:number
}