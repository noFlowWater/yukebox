import { request } from './client'
import type { SearchResult } from '@/types'

export function search(query: string, limit?: number) {
  const params = new URLSearchParams({ query })
  if (limit) params.set('limit', String(limit))
  return request<SearchResult[]>(`/api/search?${params}`)
}
