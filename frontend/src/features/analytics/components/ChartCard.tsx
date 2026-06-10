import React from "react"
import type { LucideIcon } from "lucide-react"

interface ChartCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
  action,
}) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 ${className}`}
  >
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-emerald-600" /> : null}
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        {subtitle ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
    <div className="w-full min-h-[220px] h-[min(280px,50vw)] sm:h-64">{children}</div>
  </div>
)
