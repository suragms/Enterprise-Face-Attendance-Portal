import React, { useEffect, useMemo, useState } from "react"
import { Download, ExternalLink, Search } from "lucide-react"
import { fetchMaterials, openMaterialContent } from "../../lms/api"
import { MaterialTypeBadge } from "../../lms/components/MaterialTypeBadge"
import { MATERIAL_TYPES, type MaterialType, type StudyMaterial } from "../../lms/types"
import { StudentPageHeader } from "./StudentPageHeader"

export const StudentMaterials: React.FC = () => {
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<MaterialType | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const params: Record<string, string> = { status: "APPROVED" }
    if (typeFilter) params.material_type = typeFilter
    fetchMaterials(params)
      .then(setMaterials)
      .catch((err: any) => setError(err.message || "Failed to load materials."))
      .finally(() => setLoading(false))
  }, [typeFilter])

  const filtered = useMemo(
    () =>
      materials.filter(
        (m) =>
          !search ||
          m.title?.toLowerCase().includes(search.toLowerCase()) ||
          m.description?.toLowerCase().includes(search.toLowerCase())
      ),
    [materials, search]
  )

  return (
    <div className="space-y-6">
      <StudentPageHeader
        title="Study Materials"
        description="HOD-approved content — Notes, Assignments, Slides, and Videos"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter("")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            !typeFilter ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          All
        </button>
        {MATERIAL_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTypeFilter(t.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              typeFilter === t.value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search materials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading materials...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-200 transition-colors"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-800 line-clamp-2">{item.title}</h4>
              <MaterialTypeBadge type={item.material_type} />
            </div>
            {item.description ? (
              <p className="text-[11px] text-slate-500 line-clamp-2 flex-1">{item.description}</p>
            ) : (
              <div className="flex-1" />
            )}
            <p className="mt-1 text-[10px] text-slate-400">{item.subject_code}</p>
            <button
              type="button"
              onClick={() => openMaterialContent(item.id, item.title)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              {item.material_type === "VIDEOS" ? (
                <>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open video
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {!loading && filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">No approved materials available.</p>
      ) : null}
    </div>
  )
}
