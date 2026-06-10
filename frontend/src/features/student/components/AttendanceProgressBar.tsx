import React from "react"
import { ATTENDANCE_THRESHOLD } from "../types"

interface AttendanceProgressBarProps {
  label: string
  percentage: number
  subtitle?: string
  size?: "sm" | "md" | "lg"
  showThreshold?: boolean
}

export const AttendanceProgressBar: React.FC<AttendanceProgressBarProps> = ({
  label,
  percentage,
  subtitle,
  size = "md",
  showThreshold = true,
}) => {
  const clamped = Math.min(Math.max(percentage, 0), 100)
  const atRisk = clamped < ATTENDANCE_THRESHOLD
  const barHeight = size === "lg" ? "h-4" : size === "sm" ? "h-1.5" : "h-2.5"
  const labelSize = size === "lg" ? "text-sm" : "text-xs"

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center justify-between gap-2 ${labelSize}`}>
        <span className="font-semibold text-slate-700 truncate">{label}</span>
        <span className={`shrink-0 font-bold ${atRisk ? "text-rose-600" : "text-emerald-700"}`}>
          {clamped}%
        </span>
      </div>
      <div className={`relative overflow-hidden rounded-full bg-slate-100 ${barHeight}`}>
        {showThreshold ? (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10"
            style={{ left: `${ATTENDANCE_THRESHOLD}%` }}
            title={`${ATTENDANCE_THRESHOLD}% minimum`}
          />
        ) : null}
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            atRisk ? "bg-gradient-to-r from-rose-500 to-rose-400" : "bg-gradient-to-r from-emerald-600 to-emerald-400"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {subtitle ? <p className="text-[10px] text-slate-500">{subtitle}</p> : null}
    </div>
  )
}
