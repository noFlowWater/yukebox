export interface ApiResponse<T = unknown> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function fail(code: string, message: string): ApiError {
  return { success: false, error: { code, message } }
}
