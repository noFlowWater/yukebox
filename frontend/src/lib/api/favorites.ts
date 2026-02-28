import { request } from './client'
import type { Favorite } from '@/types'

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
