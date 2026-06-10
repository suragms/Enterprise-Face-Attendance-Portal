import React, { useEffect, useMemo, useState } from "react"
import { Download, Send, ShieldCheck, XCircle } from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { isFacultyRole, isHodRole } from "../../../lib/roles"
import { FacultyScopeBanner } from "../../staff/components/FacultyScopeBanner"
import {
  approveMaterial,
  fetchMaterials,
  openMaterialContent,
  rejectMaterial,
  submitMaterial,
} from "../api"
import { LmsWorkflowBanner } from "./LmsWorkflowBanner"
import { MaterialTypeBadge } from "./MaterialTypeBadge"
import { MATERIAL_TYPES, type MaterialType, type StudyMaterial } from "../types"

export const StudyMaterialsManagement: React.FC = () => {
  const { user } = useAuth()
  const isFaculty = isFacultyRole(user?.role)
  const isHod = isHodRole(user?.role)
  const canApprove = isHod

  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState<MaterialType | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject: "",
    semester: "",
    material_type: "NOTES" as MaterialType,
    external_video_url: "",
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.material_type = typeFilter
      const [materialList, subjectData] = await Promise.all([
        fetchMaterials(params),
        apiFetch<any>("/subjects/"),
      ])
      setMaterials(materialList)
      const subjectList = subjectData.results || subjectData || []
      setSubjects(subjectList)
      if (!form.subject && subjectList.length > 0) {
        setForm((prev) => ({
          ...prev,
          subject: subjectList[0].id,
          semester: String(subjectList[0].semester),
        }))
      }
      setError("")
    } catch (err: any) {
      setError(err.message || "Failed to load study materials.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [search, statusFilter, typeFilter])

  const selectedTypeHint = MATERIAL_TYPES.find((t) => t.value === form.material_type)?.hint

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const body = new FormData()
      body.append("title", form.title)
      body.append("description", form.description)
      body.append("subject", form.subject)
      body.append("semester", form.semester)
      body.append("material_type", form.material_type)
      if (form.external_video_url) body.append("external_video_url", form.external_video_url)
      if (uploadFile) body.append("file", uploadFile)
      await apiFetch("/materials/", { method: "POST", body })
      setForm({
        title: "",
        description: "",
        subject: form.subject,
        semester: form.semester,
        material_type: form.material_type,
        external_video_url: "",
      })
      setUploadFile(null)
      await load()
    } catch (err: any) {
      setError(err.message || "Failed to upload material.")
    }
  }

  const statusBadge = useMemo(
    () => ({
      DRAFT: "bg-slate-100 text-slate-700",
      PENDING: "bg-amber-100 text-amber-700",
      APPROVED: "bg-emerald-100 text-emerald-700",
      REJECTED: "bg-rose-100 text-rose-700",
    }),
    []
  )

  const handleReject = async (id: string) => {
    const reason = rejectReason.trim() || window.prompt("Rejection reason?") || "Needs revision"
    await rejectMaterial(id, reason)
    setRejectReason("")
    await load()
  }

  const showUploadForm = isFaculty || isHod

  return (
    <div className="space-y-5">
      {isFaculty ? <FacultyScopeBanner /> : null}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Study Materials</h2>
        <p className="text-sm text-slate-500">Upload, approve, and publish learning content by type</p>
      </div>

      <LmsWorkflowBanner />

      {showUploadForm ? (
        <form onSubmit={submitUpload} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={form.material_type}
            onChange={(e) => setForm({ ...form, material_type: e.target.value as MaterialType })}
          >
            {MATERIAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="md:col-span-2 rounded-lg border px-3 py-2 text-sm"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={form.subject}
            onChange={(e) => {
              const selected = subjects.find((s) => String(s.id) === e.target.value)
              setForm({
                ...form,
                subject: e.target.value,
                semester: selected?.semester ? String(selected.semester) : form.semester,
              })
            }}
            required
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.subject_code} — {subject.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Semester ID"
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
            required
          />
          {form.material_type === "VIDEOS" ? (
            <input
              className="md:col-span-2 rounded-lg border px-3 py-2 text-sm"
              type="url"
              placeholder="Video URL (YouTube, Drive, etc.)"
              value={form.external_video_url}
              onChange={(e) => setForm({ ...form, external_video_url: e.target.value })}
            />
          ) : null}
          <input
            className="md:col-span-2 rounded-lg border px-3 py-2 text-sm"
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          />
          {selectedTypeHint ? (
            <p className="md:col-span-2 text-[11px] text-slate-500">{selectedTypeHint}</p>
          ) : null}
          <button
            type="submit"
            className="md:col-span-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Upload (starts as Draft)
          </button>
        </form>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as MaterialType | "")}
        >
          <option value="">All types</option>
          {MATERIAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading materials...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{row.title}</p>
                  {row.rejection_reason ? (
                    <p className="text-[10px] text-rose-600">{row.rejection_reason}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <MaterialTypeBadge type={row.material_type} />
                </td>
                <td className="px-4 py-3">{row.subject_code || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {(isFaculty || isHod) && (row.status === "DRAFT" || row.status === "REJECTED") ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs text-white"
                        onClick={() => submitMaterial(row.id).then(load)}
                      >
                        <Send className="h-3 w-3" />
                        Submit
                      </button>
                    ) : null}
                    {canApprove && row.status === "PENDING" ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                          onClick={() => approveMaterial(row.id).then(load)}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-xs text-white"
                          onClick={() => handleReject(row.id)}
                        >
                          <XCircle className="h-3 w-3" />
                          Reject
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-white"
                      onClick={() => openMaterialContent(row.id, row.title)}
                    >
                      <Download className="h-3 w-3" />
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && materials.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No study materials found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
