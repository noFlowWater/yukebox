import { request } from './client'
import type { QueueItem, PlaybackMode } from '@/types'

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

export function getPlaybackMode(speakerId?: number | null) {
  const params = speakerId ? `?speaker_id=${speakerId}` : ''
  return request<{ mode: PlaybackMode }>(`/api/queue/mode${params}`)
}

export function setPlaybackMode(mode: PlaybackMode, speakerId?: number | null) {
  return request<{ mode: PlaybackMode }>('/api/queue/mode', {
    method: 'PATCH',
    body: JSON.stringify({ mode, ...(speakerId && { speaker_id: speakerId }) }),
  })
}
