import { useCallback, useEffect, useState } from "react"
import { fetchAnalyticsDashboard } from "../api"
import type { AnalyticsDashboardData } from "../types"

export function useAnalyticsDashboard(initialThreshold = 75) {
  const [threshold, setThreshold] = useState(initialThreshold)
  const [data, setData] = useState<AnalyticsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (value: number) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchAnalyticsDashboard(value))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(threshold)
  }, [threshold, load])

  return { data, loading, error, threshold, setThreshold, refresh: () => load(threshold) }
}
