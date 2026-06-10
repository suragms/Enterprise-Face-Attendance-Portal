import { useCallback, useEffect, useMemo, useState } from "react"
import {
  downloadExportTask,
  fetchReport,
  fetchReportHistory,
  fetchReportMeta,
  pollExportTask,
  queueLegacyExport,
  queueReportExport,
} from "../api"
import type { ExportFormat, ReportFilters, ReportHistoryItem, ReportMeta, ReportType } from "../types"

const defaultFilters = (): ReportFilters => {
  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0]
  return {
    date: today,
    start_date: weekAgo,
    end_date: today,
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
  }
}

export function useEnterpriseReports(initialTab: ReportType = "daily") {
  const [activeTab, setActiveTab] = useState<ReportType>(initialTab)
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters)
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)
  const [history, setHistory] = useState<ReportHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)

  useEffect(() => {
    fetchReportMeta()
      .then((data) => {
        setMeta(data)
        if (data.departments[0] && !filters.department) {
          setFilters((f) => ({ ...f, department: data.departments[0].name, department_id: data.departments[0].id }))
        }
        if (data.subjects[0]) {
          setFilters((f) => ({
            ...f,
            subject_id: data.subjects[0].id,
            subject_code: data.subjects[0].subject_code,
          }))
        }
        if (data.faculty[0]) {
          setFilters((f) => ({ ...f, staff_code: data.faculty[0].staff_code, faculty_id: data.faculty[0].id }))
        }
      })
      .catch((e) => setError(e.message || "Failed to load report metadata."))
    fetchReportHistory().then(setHistory).catch(() => {})
  }, [])

  const queryFilters = useMemo(() => {
    const out: ReportFilters = { ...filters }
    Object.keys(out).forEach((k) => {
      const key = k as keyof ReportFilters
      if (out[key] === "" || out[key] === undefined) delete out[key]
    })
    return out
  }, [filters])

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReport(activeTab, queryFilters)
      setReportData(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load report."
      setError(message)
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }, [activeTab, queryFilters])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const refreshHistory = useCallback(() => {
    fetchReportHistory().then(setHistory).catch(() => {})
  }, [])

  const runExport = useCallback(
    async (format: ExportFormat) => {
      setExportingFormat(format)
      setExportStatus("Queueing export job...")
      try {
        let taskId: string
        try {
          const queued = await queueReportExport(activeTab, format, queryFilters)
          taskId = queued.task_id
        } catch {
          const legacy = await queueLegacyExport(activeTab, format, queryFilters)
          taskId = legacy.task_id
        }
        setExportStatus("Export in progress...")
        const status = await pollExportTask(taskId)
        const ext = format === "excel" ? "xlsx" : format
        await downloadExportTask(taskId, status.filename || `hexaattender_${activeTab}_report.${ext}`)
        setExportStatus("Export completed.")
        refreshHistory()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Export failed."
        setExportStatus(null)
        throw new Error(message)
      } finally {
        setExportingFormat(null)
      }
    },
    [activeTab, queryFilters, refreshHistory]
  )

  const updateFilter = useCallback((patch: Partial<ReportFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  return {
    activeTab,
    setActiveTab,
    filters,
    updateFilter,
    meta,
    reportData,
    history,
    loading,
    error,
    exportStatus,
    exportingFormat,
    runExport,
    loadReport,
    refreshHistory,
  }
}
