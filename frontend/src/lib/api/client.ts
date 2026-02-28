import type { ApiResponse, ApiErrorResponse } from '@/types'

export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

const BASE_URL = ''  // Relative path — Next.js rewrites proxy /api/* to backend

let refreshPromise: Promise<void> | null = null

async function refreshToken(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new ApiError('REFRESH_FAILED', 'Session expired')
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = options?.body
    ? { 'Content-Type': 'application/json' }
    : {}
  let res = await fetch(`${BASE_URL}${path}`, {
    headers,
    credentials: 'include',
    ...options,
  })

  // Auto-refresh on 401 (skip for auth routes to prevent loops)
  if (res.status === 401 && !path.includes('/auth/')) {
    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => { refreshPromise = null })
    }
    try {
      await refreshPromise
      res = await fetch(`${BASE_URL}${path}`, {
        headers,
        credentials: 'include',
        ...options,
      })
    } catch {
      throw new ApiError('UNAUTHORIZED', 'Session expired. Please log in again.')
    }
  }

  const json: ApiResponse<T> | ApiErrorResponse = await res.json()

  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message)
  }

  return json.data
}
