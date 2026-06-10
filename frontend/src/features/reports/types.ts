export type ReportTab = ReportType

export type ReportType =
  | "daily"
  | "weekly"
  | "monthly"
  | "semester"
  | "department"
  | "student"
  | "faculty"
  | "subject"

export type ExportFormat = "csv" | "excel" | "pdf"

export interface ReportFilters {
  date?: string
  start_date?: string
  end_date?: string
  month?: string
  year?: string
  department?: string
  department_id?: string
  course?: string
  course_id?: string
  semester?: string
  semester_id?: string
  subject_id?: string
  subject_code?: string
  staff_code?: string
  faculty_id?: string
  roll_no?: string
  student_id?: string
}

export interface ReportMeta {
  report_types: ReportType[]
  export_formats: ExportFormat[]
  filters: Record<string, string[]>
  departments: { id: string; name: string; code: string }[]
  courses: { id: string; name: string; code: string }[]
  semesters: { id: string; number: number; course_id: string }[]
  subjects: {
    id: string
    subject_code: string
    name: string
    department_id: string
    course_id: string
    semester_id: string
  }[]
  faculty: { id: string; staff_code: string; first_name: string; last_name: string }[]
}

export interface ReportHistoryItem {
  id: string
  report_type: string
  title: string
  file_format: string
  status: string
  parameters: { report_type?: string; filters?: ReportFilters; task_id?: string }
  completed_at: string | null
  created_at: string
  generated_by_name?: string
  error_message?: string
}

export interface ExportTaskStatus {
  task_id: string
  state: string
  ready: boolean
  filename?: string
  error?: string
  history_id?: string
}
