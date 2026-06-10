import React, { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  BookOpen,
  Calendar,
  CalendarClock,
  Download,
  ExternalLink,
  GraduationCap,
} from "lucide-react"
import { API_BASE, apiFetch } from "../../../lib/api"
import { fetchLmsHub, fetchMaterials, openMaterialContent } from "../api"
import { MaterialTypeBadge } from "./MaterialTypeBadge"
import { MATERIAL_TYPES, type MaterialType, type StudyMaterial } from "../types"

export const StudentLearningHub: React.FC = () => {
  const [hub, setHub] = useState<any>(null)
  const [courses, setCourses] = useState<any[]>([])
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [activeType, setActiveType] = useState<MaterialType | "ALL">("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [hubData, coursesData, materialsData, examsData] = await Promise.all([
          fetchLmsHub(),
          apiFetch<any>("/courses/"),
          fetchMaterials({ status: "APPROVED" }),
          apiFetch<any>("/exams/?status=PUBLISHED"),
        ])
        setHub(hubData)
        setCourses(coursesData.results || coursesData || [])
        setMaterials(materialsData)
        setExams(examsData.results || examsData || [])
        setError("")
      } catch (err: any) {
        setError(err.message || "Failed to load learning hub.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredMaterials = useMemo(() => {
    if (activeType === "ALL") return materials
    return materials.filter((m) => m.material_type === activeType)
  }, [materials, activeType])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Student Learning Hub</p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Your learning workspace</h2>
            <p className="mt-2 text-sm text-emerald-100">
              Approved materials only — faculty upload → HOD approval → you download
            </p>
          </div>
          <GraduationCap className="h-14 w-14 opacity-80 hidden sm:block" />
        </div>
        {hub ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/15 p-3 text-center">
              <p className="text-2xl font-bold">{hub.courses_count}</p>
              <p className="text-[10px] uppercase opacity-90">Courses</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 text-center">
              <p className="text-2xl font-bold">{hub.materials_count}</p>
              <p className="text-[10px] uppercase opacity-90">Materials</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 text-center">
              <p className="text-2xl font-bold">{hub.exams_count}</p>
              <p className="text-[10px] uppercase opacity-90">Exams</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 text-center">
              <p className="text-2xl font-bold">{hub.materials_by_type?.VIDEOS ?? 0}</p>
              <p className="text-[10px] uppercase opacity-90">Videos</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/student/timetable"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-emerald-200"
        >
          <Calendar className="h-4 w-4 text-emerald-600" />
          Class timetable
        </Link>
        <a
          href={`${API_BASE}/timetable/export-pdf/`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
        >
          <Download className="h-4 w-4" />
          Timetable PDF
        </a>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading learning resources...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <BookOpen className="h-4 w-4 text-emerald-600" />
            My courses
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            {courses.map((course) => (
              <li key={course.id} className="rounded-lg border border-slate-100 p-2.5">
                <span className="font-bold text-slate-800">{course.code}</span>
                <span className="block text-slate-500">{course.name}</span>
              </li>
            ))}
            {courses.length === 0 ? <li className="text-slate-400">No courses listed.</li> : null}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">Study materials</h3>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setActiveType("ALL")}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  activeType === "ALL" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                All
              </button>
              {MATERIAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActiveType(t.value)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    activeType === t.value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredMaterials.map((item) => (
              <div key={item.id} className="flex flex-col rounded-lg border border-slate-100 p-3 hover:border-emerald-200">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800 line-clamp-2">{item.title}</p>
                  <MaterialTypeBadge type={item.material_type} />
                </div>
                <p className="text-[10px] text-slate-500 flex-1">{item.subject_code}</p>
                <button
                  type="button"
                  onClick={() => openMaterialContent(item.id, item.title)}
                  className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-semibold text-white"
                >
                  {item.material_type === "VIDEOS" ? (
                    <>
                      <ExternalLink className="h-3 w-3" />
                      Watch / open
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" />
                      Download
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
          {filteredMaterials.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No approved materials in this category.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <CalendarClock className="h-4 w-4 text-violet-600" />
          Upcoming exams
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <div key={exam.id} className="rounded-lg border border-violet-100 bg-violet-50/40 p-3 text-xs">
              <p className="font-bold text-slate-800">{exam.subject_code || exam.title}</p>
              <p className="text-slate-600">{exam.exam_date}</p>
              <p className="text-slate-500">
                {String(exam.starts_at).slice(0, 5)} – {String(exam.ends_at).slice(0, 5)}
                {exam.room ? ` • ${exam.room}` : ""}
              </p>
            </div>
          ))}
        </div>
        {exams.length === 0 ? <p className="text-xs text-slate-400">No published exams.</p> : null}
        <Link
          to="/student/exams"
          className="mt-3 inline-block text-xs font-semibold text-violet-700 hover:underline"
        >
          View full exam timetable →
        </Link>
      </div>
    </div>
  )
}
