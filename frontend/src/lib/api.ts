const DEFAULT_API_BASE = import.meta.env.DEV ? "http://localhost:8000/api/v1" : "/api/v1"
export const API_BASE = import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE

let csrfToken = ""

export const setCsrfToken = (token?: string) => {
  csrfToken = token ?? ""
}

const readCsrfCookie = () => {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ""
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  headers?: Record<string, string>
}

export const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&")
}

export const getAuthHeaders = () => {
  const token = csrfToken || readCsrfCookie()
  return token ? { "X-CSRFToken": token } : {}
}

let isRefreshing = false
let refreshPromise: Promise<void> | null = null

const requestRefresh = async () => {
  if (!isRefreshing) {
    isRefreshing = true
    refreshPromise = fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) }
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired.")
        const data = await response.json()
        setCsrfToken(data.csrfToken)
      })
      .finally(() => {
        isRefreshing = false
      })
  }
  return refreshPromise
}

export const apiFetch = async <T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> => {
  const resolvedCsrfToken = csrfToken || readCsrfCookie()
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(resolvedCsrfToken ? { "X-CSRFToken": resolvedCsrfToken } : {}),
    ...(options.headers as Record<string, string> | undefined)
  }
  if (!isFormDataBody) {
    headers["Content-Type"] = "application/json"
  }

  const body = options.body !== undefined
    ? typeof options.body === "string"
      ? options.body
      : isFormDataBody
        ? options.body as any
        : JSON.stringify(options.body)
    : undefined

  const execute = () => fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
    body
  })

  let response = await execute()
  if (
    response.status === 401 &&
    !endpoint.includes("/auth/token/") &&
    !endpoint.includes("/auth/logout/") &&
    !endpoint.includes("/auth/me/")
  ) {
    try {
      await requestRefresh()
      response = await execute()
    } catch {
      window.dispatchEvent(new Event("auth_expired"))
      throw new Error("Session expired. Please log in again.")
    }
  }

  const contentType = response.headers.get("content-type") || ""
  const text = await response.text()
  const data = text ? (contentType.includes("application/json") ? JSON.parse(text) : text) : null

  if (!response.ok) {
    const message = typeof data === "object" && data !== null
      ? (data.detail || data.error || JSON.stringify(data))
      : response.statusText
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (data && typeof data === "object" && "csrfToken" in data) {
    setCsrfToken(String((data as { csrfToken: string }).csrfToken))
  }

  return data as T
}
