import { apiFetch } from "../../lib/api"
import type {
  NotificationLog,
  NotificationMeta,
  NotificationSchedule,
  NotificationTemplate,
  NotificationChannel,
  TriggerType,
} from "./types"

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results ?? []
}

export async function fetchNotificationMeta(): Promise<NotificationMeta> {
  return apiFetch<NotificationMeta>("/notifications/meta/")
}

export async function fetchTemplates(): Promise<NotificationTemplate[]> {
  return unwrapList(await apiFetch("/notifications/templates/"))
}

export async function saveTemplate(template: Partial<NotificationTemplate> & { id?: string }) {
  if (template.id) {
    return apiFetch(`/notifications/templates/${template.id}/`, { method: "PUT", body: template })
  }
  return apiFetch("/notifications/templates/", { method: "POST", body: template })
}

export async function fetchLogs(params: Record<string, string> = {}): Promise<NotificationLog[]> {
  const query = new URLSearchParams(params).toString()
  const path = query ? `/notifications/logs/?${query}` : "/notifications/logs/"
  return unwrapList(await apiFetch(path))
}

export async function triggerNotification(body: Record<string, unknown>) {
  return apiFetch("/notifications/trigger/", { method: "POST", body })
}

export async function retryLog(id: string) {
  return apiFetch(`/notifications/logs/${id}/retry/`, { method: "POST" })
}

export async function bulkRetryFailed() {
  return apiFetch<{ queued: number }>("/notifications/logs/bulk-retry/", {
    method: "POST",
    body: { failed_only: true },
  })
}

export async function fetchSchedules(): Promise<NotificationSchedule[]> {
  return unwrapList(await apiFetch("/notifications/schedules/"))
}

export async function saveSchedule(schedule: Partial<NotificationSchedule> & { id?: string }) {
  if (schedule.id) {
    return apiFetch(`/notifications/schedules/${schedule.id}/`, { method: "PUT", body: schedule })
  }
  return apiFetch("/notifications/schedules/", { method: "POST", body: schedule })
}

export async function runScheduleNow(id: string) {
  return apiFetch(`/notifications/schedules/${id}/run-now/`, { method: "POST" })
}

export async function pauseSchedule(id: string) {
  return apiFetch(`/notifications/schedules/${id}/pause/`, { method: "POST" })
}

export function recipientForChannel(
  channel: NotificationChannel,
  student: { email?: string; phone?: string; user?: string; id?: string }
): string {
  if (channel === "EMAIL") return student.email || ""
  if (channel === "IN_APP") return student.user || student.id || ""
  return student.phone || ""
}

export function defaultTriggerContext(trigger: TriggerType) {
  const base = {
    student_name: "Sample Student",
    roll_no: "CS-001",
    attendance_percentage: 72,
    subject_name: "Software Engineering",
    date: new Date().toISOString().split("T")[0],
    hour: "II",
    summary_date: new Date().toISOString().split("T")[0],
    alert_title: "System Alert",
    alert_message: "Test notification from HexaAttender.",
  }
  if (trigger === "ADMIN_ALERT") return { alert_title: base.alert_title, alert_message: base.alert_message }
  return base
}
