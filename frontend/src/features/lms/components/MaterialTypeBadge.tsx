import React from "react"
import { BookOpen, ClipboardList, Film, Presentation } from "lucide-react"
import { MATERIAL_TYPE_LABELS, type MaterialType } from "../types"

const CONFIG: Record<MaterialType, { icon: React.ElementType; className: string }> = {
  NOTES: { icon: BookOpen, className: "bg-blue-50 text-blue-700 border-blue-100" },
  ASSIGNMENTS: { icon: ClipboardList, className: "bg-amber-50 text-amber-700 border-amber-100" },
  SLIDES: { icon: Presentation, className: "bg-violet-50 text-violet-700 border-violet-100" },
  VIDEOS: { icon: Film, className: "bg-rose-50 text-rose-700 border-rose-100" },
}

export const MaterialTypeBadge: React.FC<{ type: MaterialType }> = ({ type }) => {
  const cfg = CONFIG[type] || CONFIG.NOTES
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {MATERIAL_TYPE_LABELS[type]}
    </span>
  )
}
