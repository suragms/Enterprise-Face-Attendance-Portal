import { apiFetch } from "../../lib/api"
import type { AnalyticsDashboardData } from "./types"

export async function fetchAnalyticsDashboard(threshold = 75): Promise<AnalyticsDashboardData> {
  return apiFetch<AnalyticsDashboardData>(`/reports/analytics/dashboard/?threshold=${threshold}`)
}
