export type MaterialType = "NOTES" | "ASSIGNMENTS" | "SLIDES" | "VIDEOS"
export type MaterialStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"

export const MATERIAL_TYPES: { value: MaterialType; label: string; hint: string }[] = [
  { value: "NOTES", label: "Notes", hint: "Lecture notes, PDFs, documents" },
  { value: "ASSIGNMENTS", label: "Assignments", hint: "Homework, problem sets, zip bundles" },
  { value: "SLIDES", label: "Slides", hint: "Presentations (PPT/PDF)" },
  { value: "VIDEOS", label: "Videos", hint: "External video URL or uploaded file" },
]

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  NOTES: "Notes",
  ASSIGNMENTS: "Assignments",
  SLIDES: "Slides",
  VIDEOS: "Videos",
}

export interface StudyMaterial {
  id: string
  title: string
  description?: string
  status: MaterialStatus
  material_type: MaterialType
  material_kind?: string
  subject_code?: string
  subject_name?: string
  semester_number?: number
  external_video_url?: string
  rejection_reason?: string
  uploaded_by_name?: string
  has_file?: boolean
  is_video?: boolean
  can_download?: boolean
}

export interface LmsHubSummary {
  courses_count: number
  materials_count: number
  exams_count: number
  materials_by_type: Record<MaterialType, number>
  workflow: { draft: number; pending: number; approved: number; rejected: number }
  workflow_steps: string[]
}

export interface Course {
  id: string
  code: string
  name: string
  department: string
  department_name?: string
  duration_semesters: number
  is_active?: boolean
}
