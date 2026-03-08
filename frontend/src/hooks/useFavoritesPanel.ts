import { useEffect, useState, useCallback } from 'react'
import { handleApiError } from '@/lib/utils'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import { useMultiSelect } from '@/hooks/useMultiSelect'
import * as api from '@/lib/api'
import type { Favorite, SearchResult } from '@/types'

interface UseFavoritesPanelParams {
  onBulkAddToQueue: (items: SearchResult[]) => void
  onSchedule: (items: SearchResult[], scheduledAt: string) => void
}

export function useFavoritesPanel({ onBulkAddToQueue, onSchedule }: UseFavoritesPanelParams) {
  const { timezone } = useAccessibility()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [scheduleOpenId, setScheduleOpenId] = useState<number | null>(null)
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false)

  const {
    selectedOrder, selectedSet, selectedItems, totalDuration,
    toggleSelect, toggleAll, clearSelection,
  } = useMultiSelect(favorites)

  const handleBulkQueue = useCallback(() => {
    onBulkAddToQueue(selectedItems.map((f) => ({ url: f.url, title: f.title, thumbnail: f.thumbnail, duration: f.duration })))
    clearSelection()
  }, [selectedItems, onBulkAddToQueue, clearSelection])

  const handleBulkSchedule = useCallback(
    (scheduledAt: string) => {
      onSchedule(
        selectedItems.map((f) => ({ url: f.url, title: f.title, thumbnail: f.thumbnail, duration: f.duration })),
        scheduledAt
      )
      clearSelection()
      setBulkScheduleOpen(false)
    },
    [selectedItems, onSchedule, clearSelection]
  )

  const fetchFavorites = useCallback(async () => {
    try {
      const items = await api.getFavorites()
      setFavorites(items)
    } catch {
      // silent on fetch errors
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFavorites()
    const onUpdate = () => fetchFavorites()
    window.addEventListener('favorites-updated', onUpdate)
    return () => {
      window.removeEventListener('favorites-updated', onUpdate)
    }
  }, [fetchFavorites])

  const handleRemove = useCallback(async (id: number) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id))
    clearSelection()
    try {
      await api.removeFavorite(id)
      window.dispatchEvent(new Event('favorites-updated'))
    } catch (err) {
      handleApiError(err, 'Failed to remove favorite')
      fetchFavorites()
    }
  }, [fetchFavorites, clearSelection])

  const handleSchedule = useCallback((item: Favorite, scheduledAt: string) => {
    onSchedule([{
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration,
    }], scheduledAt)
    setScheduleOpenId(null)
  }, [onSchedule])

  const allSelected = favorites.length > 0 && selectedOrder.length === favorites.length

  return {
    favorites,
    isLoading,
    scheduleOpenId,
    bulkScheduleOpen,
    timezone,
    selectedOrder,
    selectedSet,
    selectedItems,
    totalDuration,
    allSelected,
    setScheduleOpenId,
    setBulkScheduleOpen,
    toggleSelect,
    toggleAll,
    clearSelection,
    handleBulkQueue,
    handleBulkSchedule,
    handleRemove,
    handleSchedule,
  }
}
