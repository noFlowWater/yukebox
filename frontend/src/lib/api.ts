import type {
  ApiResponse,
  ApiErrorResponse,
  AvailableSink,
  BluetoothDevice,
  AdapterStatus,
  ConnectResult,
  Favorite,
  PlayResult,
  PlaybackStatus,
  QueueItem,
  Schedule,
  SearchResult,
  Settings,
  Speaker,
  SpeakerStatus,
  User,
} from '@/types'

const BASE_URL = ''  // Relative path — Next.js rewrites proxy /api/* to backend

class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

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

async function request<T>(
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

// --- Auth ---

export function getSetupStatus() {
  return request<{ hasUsers: boolean }>('/api/auth/setup-status')
}

export function register(username: string, password: string) {
  return request<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function login(username: string, password: string) {
  return request<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return request<{ loggedOut: boolean }>('/api/auth/logout', {
    method: 'POST',
  })
}

export function getMe() {
  return request<User>('/api/auth/me')
}

// --- Admin ---

export function getUsers() {
  return request<User[]>('/api/admin/users')
}

export function deleteUser(id: number) {
  return request<{ removed: boolean }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  })
}

export function updateUserRole(id: number, role: 'admin' | 'user') {
  return request<User>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

// --- Playback ---

export function play(body: { url?: string; query?: string; title?: string; thumbnail?: string; duration?: number; speaker_id?: number }) {
  return request<PlayResult>('/api/play', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function stop(speakerId?: number | null) {
  return request<{ stopped: boolean }>('/api/stop', {
    method: 'POST',
    body: speakerId ? JSON.stringify({ speaker_id: speakerId }) : undefined,
  })
}

export function pause(speakerId?: number | null) {
  return request<{ toggled: boolean }>('/api/pause', {
    method: 'POST',
    body: speakerId ? JSON.stringify({ speaker_id: speakerId }) : undefined,
  })
}

export function setVolume(volume: number, speakerId?: number | null) {
  return request<{ volume: number }>('/api/volume', {
    method: 'POST',
    body: JSON.stringify({ volume, ...(speakerId && { speaker_id: speakerId }) }),
  })
}

export function seek(position: number, speakerId?: number | null) {
  return request<{ position: number }>('/api/seek', {
    method: 'POST',
    body: JSON.stringify({ position, ...(speakerId && { speaker_id: speakerId }) }),
  })
}

// --- Status ---

export function resolveUrl(url: string) {
  return request<SearchResult>('/api/resolve', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export function getStatus() {
  return request<PlaybackStatus>('/api/status')
}

export function getStatusAll() {
  return request<SpeakerStatus[]>('/api/status/all')
}

export function getStatusStreamUrl(speakerId?: number | null) {
  const params = speakerId ? `?speaker_id=${speakerId}` : ''
  return `/api/status/stream${params}`
}

// --- Queue ---

export function getQueue(speakerId?: number | null) {
  const params = speakerId ? `?speaker_id=${speakerId}` : ''
  return request<QueueItem[]>(`/api/queue${params}`)
}

export function addToQueue(body: { url?: string; query?: string; title?: string; thumbnail?: string; duration?: number; speaker_id?: number }) {
  return request<QueueItem>('/api/queue', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function removeFromQueue(id: number) {
  return request<{ removed: boolean }>(`/api/queue/${id}`, {
    method: 'DELETE',
  })
}

export function updateQueuePosition(id: number, position: number) {
  return request<{ updated: boolean }>(`/api/queue/${id}/position`, {
    method: 'PATCH',
    body: JSON.stringify({ position }),
  })
}

export function playFromQueue(id: number) {
  return request<QueueItem>(`/api/queue/${id}/play`, {
    method: 'POST',
  })
}

export function bulkAddToQueue(items: { url: string; title?: string; thumbnail?: string; duration?: number }[], speaker_id?: number) {
  return request<QueueItem[]>('/api/queue/bulk', {
    method: 'POST',
    body: JSON.stringify({ items, ...(speaker_id && { speaker_id }) }),
  })
}

export function clearQueue(speakerId?: number | null) {
  const params = speakerId ? `?speaker_id=${speakerId}` : ''
  return request<{ removed: number }>(`/api/queue${params}`, {
    method: 'DELETE',
  })
}

export function shuffleQueue(speakerId?: number | null) {
  const params = speakerId ? `?speaker_id=${speakerId}` : ''
  return request<{ shuffled: boolean }>(`/api/queue/shuffle${params}`, {
    method: 'POST',
  })
}

// --- Schedules ---

export function getSchedules(speakerId?: number | null) {
  const params = speakerId ? `?speaker_id=${speakerId}` : ''
  return request<Schedule[]>(`/api/schedules${params}`)
}

export function createSchedule(body: {
  url?: string
  query?: string
  title?: string
  thumbnail?: string
  duration?: number
  scheduled_at: string
  group_id?: string
  speaker_id?: number
}) {
  return request<Schedule>('/api/schedules', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function deleteSchedule(id: number) {
  return request<{ removed: boolean }>(`/api/schedules/${id}`, {
    method: 'DELETE',
  })
}

export function updateScheduleTime(id: number, scheduled_at: string) {
  return request<Schedule[]>(`/api/schedules/${id}/time`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduled_at }),
  })
}

export function deleteAllSchedules(speakerId?: number | null) {
  const params = speakerId ? `?speaker_id=${speakerId}` : ''
  return request<{ removed: number }>(`/api/schedules${params}`, {
    method: 'DELETE',
  })
}

// --- Search ---

export function search(query: string, limit?: number) {
  const params = new URLSearchParams({ query })
  if (limit) params.set('limit', String(limit))
  return request<SearchResult[]>(`/api/search?${params}`)
}

// --- Speakers ---

export function getSpeakers() {
  return request<Speaker[]>('/api/speakers')
}

export function getAvailableSinks() {
  return request<AvailableSink[]>('/api/speakers/available')
}

export function registerSpeaker(sink_name: string, display_name: string) {
  return request<Speaker>('/api/speakers', {
    method: 'POST',
    body: JSON.stringify({ sink_name, display_name }),
  })
}

export function renameSpeaker(id: number, display_name: string) {
  return request<Speaker>(`/api/speakers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ display_name }),
  })
}

export function removeSpeaker(id: number) {
  return request<{ removed: boolean }>(`/api/speakers/${id}`, {
    method: 'DELETE',
  })
}

export function setSpeakerDefault(id: number) {
  return request<Speaker>(`/api/speakers/${id}/default`, {
    method: 'PATCH',
  })
}

export function activateSpeaker(id: number) {
  return request<Speaker>(`/api/speakers/${id}/activate`, {
    method: 'POST',
  })
}

export function updateSpeakerVolume(id: number, default_volume: number | null) {
  return request<Speaker>(`/api/speakers/${id}/volume`, {
    method: 'PATCH',
    body: JSON.stringify({ default_volume }),
  })
}

// --- Settings ---

export function getSettings() {
  return request<Settings>('/api/settings')
}

export function updateSettings(body: Partial<Settings>) {
  return request<Settings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// --- Bluetooth ---

export function getBluetoothStatus() {
  return request<AdapterStatus>('/api/bluetooth/status')
}

export function getBluetoothDevices() {
  return request<BluetoothDevice[]>('/api/bluetooth/devices')
}

export function connectBluetoothDevice(address: string) {
  return request<ConnectResult>(`/api/bluetooth/connect/${encodeURIComponent(address)}`, { method: 'POST' })
}

export function disconnectBluetoothDevice(address: string) {
  return request<{ address: string; disconnected: boolean }>(`/api/bluetooth/disconnect/${encodeURIComponent(address)}`, { method: 'POST' })
}

export function getBluetoothScanStreamUrl(duration?: number) {
  return `/api/bluetooth/scan/stream${duration ? `?duration=${duration}` : ''}`
}

// --- Favorites ---

export function getFavorites() {
  return request<Favorite[]>('/api/favorites')
}

export function addFavorite(body: { url: string; title: string; thumbnail: string; duration: number }) {
  return request<Favorite>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function removeFavorite(id: number) {
  return request<{ removed: boolean }>(`/api/favorites/${id}`, {
    method: 'DELETE',
  })
}

export function checkBulkFavorites(urls: string[]) {
  return request<Record<string, number | null>>('/api/favorites/check', {
    method: 'POST',
    body: JSON.stringify({ urls }),
  })
}

export { ApiError }
