import { request } from './client'
import type { Settings } from '@/types'

export function getSettings() {
  return request<Settings>('/api/settings')
}

export function updateSettings(body: Partial<Settings>) {
  return request<Settings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
