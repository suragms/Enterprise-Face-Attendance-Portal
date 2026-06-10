import React from "react"
import { CheckCircle2, Clock, FileSpreadsheet, FileText, Loader2, XCircle } from "lucide-react"
import type { ExportFormat, ReportHistoryItem } from "../types"

interface Props {
  history: ReportHistoryItem[]
  exportStatus: string | null
  exportingFormat: ExportFormat | null
  onExport: (format: ExportFormat) => void
  disabled?: boolean
}

const statusIcon: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  FAILED: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
  PROCESSING: <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />,
  PENDING: <Clock className="w-3.5 h-3.5 text-amber-600" />,
}

export const ExportJobPanel: React.FC<Props> = ({
  history,
  exportStatus,
  exportingFormat,
  onExport,
  disabled,
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onExport("pdf")}
        disabled={disabled || !!exportingFormat}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold"
      >
        {exportingFormat === "pdf" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        PDF
      </button>
      <button
        type="button"
        onClick={() => onExport("excel")}
        disabled={disabled || !!exportingFormat}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold"
      >
        {exportingFormat === "excel" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
        Excel
      </button>
      <button
        type="button"
        onClick={() => onExport("csv")}
        disabled={disabled || !!exportingFormat}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold"
      >
        {exportingFormat === "csv" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
        CSV
      </button>
      {exportStatus && <span className="text-[10px] text-slate-500 font-medium">{exportStatus}</span>}
    </div>

    {history.length > 0 && (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
          Recent export jobs (background)
        </div>
        <ul className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
          {history.slice(0, 8).map((job) => (
            <li key={job.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-700">{job.title}</span>
              <span className="flex items-center gap-1 shrink-0 text-slate-500">
                {statusIcon[job.status] || statusIcon.PENDING}
                {job.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
)
