import { request } from './client'
import type { Schedule } from '@/types'

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
