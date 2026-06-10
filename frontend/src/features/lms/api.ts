import { API_BASE, apiFetch, getAuthHeaders } from "../../lib/api"
import type { LmsHubSummary, StudyMaterial } from "./types"

export async function fetchLmsHub(): Promise<LmsHubSummary> {
  return apiFetch<LmsHubSummary>("/materials/hub/")
}

export async function fetchMaterials(params: Record<string, string> = {}): Promise<StudyMaterial[]> {
  const query = new URLSearchParams(params).toString()
  const data = await apiFetch<StudyMaterial[] | { results: StudyMaterial[] }>(
    `/materials/${query ? `?${query}` : ""}`
  )
  return Array.isArray(data) ? data : data.results ?? []
}

export async function submitMaterial(id: string) {
  return apiFetch(`/materials/${id}/submit/`, { method: "POST" })
}

export async function approveMaterial(id: string) {
  return apiFetch(`/materials/${id}/approve/`, { method: "POST" })
}

export async function rejectMaterial(id: string, reason: string) {
  return apiFetch(`/materials/${id}/reject/`, { method: "POST", body: { reason } })
}

export async function openMaterialContent(id: string, title: string) {
  const response = await fetch(`${API_BASE}/materials/${id}/download/`, {
    credentials: "include",
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || "Download failed.")
  }
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const payload = await response.json()
    if (payload.type === "video_link" && payload.url) {
      window.open(payload.url, "_blank", "noopener,noreferrer")
      return
    }
    throw new Error("No downloadable content.")
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = title.replace(/\s+/g, "_") || "material"
  anchor.click()
  URL.revokeObjectURL(url)
}
