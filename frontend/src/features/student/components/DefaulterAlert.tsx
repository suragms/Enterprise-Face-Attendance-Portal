import React from "react"
import { AlertTriangle, ShieldAlert } from "lucide-react"
import { ATTENDANCE_THRESHOLD } from "../types"
import type { StudentSubjectAttendance } from "../types"

interface DefaulterAlertProps {
  overallPercentage: number
  promotionStatus?: "ELIGIBLE" | "DETAINED"
  atRiskSubjects?: StudentSubjectAttendance[]
  compact?: boolean
}

export const DefaulterAlert: React.FC<DefaulterAlertProps> = ({
  overallPercentage,
  promotionStatus,
  atRiskSubjects = [],
  compact = false,
}) => {
  const isDefaulter = overallPercentage < ATTENDANCE_THRESHOLD || promotionStatus === "DETAINED"
  const atRisk = atRiskSubjects.filter((s) => s.percentage < ATTENDANCE_THRESHOLD)

  if (!isDefaulter && atRisk.length === 0) return null

  return (
    <div className={`rounded-xl border ${isDefaulter ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"} p-4`}>
      <div className="flex gap-3">
        {isDefaulter ? (
          <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-sm font-bold ${isDefaulter ? "text-rose-800" : "text-amber-800"}`}>
            {isDefaulter ? "Attendance defaulter alert" : "Subject at-risk alert"}
          </p>
          <p className={`text-xs leading-relaxed ${isDefaulter ? "text-rose-700" : "text-amber-700"}`}>
            {isDefaulter
              ? `Your overall attendance is ${overallPercentage}%, below the required ${ATTENDANCE_THRESHOLD}%. You may be detained from promotion.`
              : `Some subjects are below ${ATTENDANCE_THRESHOLD}% attendance. Improve before the cutoff.`}
          </p>
          {!compact && atRisk.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {atRisk.map((subject) => (
                <li
                  key={subject.code}
                  className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-rose-700 border border-rose-100"
                >
                  {subject.code}: {subject.percentage}%
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
