import * as api from '@/lib/api'
import { handleApiError } from '@/lib/utils'
import type { SearchResult } from '@/types'

interface FavoriteToggleParams {
  url: string
  title: string
  thumbnail: string
  duration: number
  currentFavoriteId: number | null
  onOptimistic: (id: number | null) => void
  onRollback: (id: number | null) => void
  onSuccess: (url: string, favoriteId: number | null) => void
}

export async function toggleFavorite({
  url,
  title,
  thumbnail,
  duration,
  currentFavoriteId,
  onOptimistic,
  onRollback,
  onSuccess,
}: FavoriteToggleParams): Promise<void> {
  if (currentFavoriteId !== null) {
    onOptimistic(null)
    try {
      await api.removeFavorite(currentFavoriteId)
      onSuccess(url, null)
      window.dispatchEvent(new Event('favorites-updated'))
    } catch (err) {
      onRollback(currentFavoriteId)
      handleApiError(err, 'Failed to remove favorite')
    }
  } else {
    onOptimistic(-1)
    try {
      const fav = await api.addFavorite({ url, title, thumbnail, duration })
      onOptimistic(fav.id)
      onSuccess(url, fav.id)
      window.dispatchEvent(new Event('favorites-updated'))
    } catch (err) {
      onRollback(null)
      handleApiError(err, 'Failed to add favorite')
    }
  }
}
