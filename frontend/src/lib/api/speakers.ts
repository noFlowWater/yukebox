import { request } from './client'
import type { AvailableSink, Speaker } from '@/types'

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
