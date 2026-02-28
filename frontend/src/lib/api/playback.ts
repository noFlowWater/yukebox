import { request } from './client'
import type { PlayResult, PlaybackStatus, SearchResult, SpeakerStatus } from '@/types'

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
