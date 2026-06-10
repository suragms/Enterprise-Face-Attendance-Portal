import { API_BASE, apiFetch, buildQueryString } from "../../lib/api"
import type {
  ExportFormat,
  ExportTaskStatus,
  ReportFilters,
  ReportHistoryItem,
  ReportMeta,
  ReportType,
} from "./types"

export async function fetchReportMeta(): Promise<ReportMeta> {
  return apiFetch<ReportMeta>("/reports/meta/")
}

export async function fetchReport<T = Record<string, unknown>>(
  type: ReportType,
  filters: ReportFilters = {}
): Promise<T> {
  const query = buildQueryString(filters as Record<string, string>)
  return apiFetch<T>(`/reports/${type}/${query ? `?${query}` : ""}`)
}

export async function fetchReportHistory(mine = false): Promise<ReportHistoryItem[]> {
  const query = mine ? "?mine=true" : ""
  return apiFetch<ReportHistoryItem[]>(`/reports/history/${query}`)
}

export async function queueReportExport(
  reportType: ReportType,
  format: ExportFormat,
  filters: ReportFilters
): Promise<{ task_id: string; history_id: string }> {
  return apiFetch("/reports/generate/", {
    method: "POST",
    body: {
      report_type: reportType,
      format,
      async_export: true,
      filters,
    },
  })
}

export async function queueLegacyExport(
  reportType: ReportType,
  format: ExportFormat,
  filters: ReportFilters
): Promise<{ task_id: string }> {
  const query = buildQueryString({ ...filters, report_type: reportType, async: "true" } as Record<string, string>)
  return apiFetch(`/reports/export/${format}/?${query}`)
}

export async function pollExportTask(taskId: string, maxAttempts = 45): Promise<ExportTaskStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    const status = await apiFetch<ExportTaskStatus>(`/reports/export/tasks/${taskId}/status/`)
    if (status.state === "FAILURE") {
      throw new Error(status.error || "Background export failed.")
    }
    if (status.ready) return status
  }
  throw new Error("Export timed out. Please try again.")
}

export async function downloadExportTask(taskId: string, filename: string) {
  const response = await fetch(`${API_BASE}/reports/export/tasks/${taskId}/download/`, {
    credentials: "include",
  })
  if (!response.ok) throw new Error("Failed to download export file.")
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}
