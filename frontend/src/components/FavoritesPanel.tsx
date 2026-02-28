'use client'

import { useEffect, useState, useCallback } from 'react'
import { Heart, Play, ListPlus, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'
import { SelectableCheckbox } from '@/components/SelectableCheckbox'
import { BulkActionBar } from '@/components/BulkActionBar'
import { useMultiSelect } from '@/hooks/useMultiSelect'
import Image from 'next/image'
import { formatDuration, handleApiError } from '@/lib/utils'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import * as api from '@/lib/api'
import type { Favorite, SearchResult } from '@/types'

interface FavoritesPanelProps {
  onPlay: (item: SearchResult) => void
  onAddToQueue: (item: SearchResult) => void
  onBulkAddToQueue: (items: SearchResult[]) => void
  onSchedule: (items: SearchResult[], scheduledAt: string) => void
}

export function FavoritesPanel({ onPlay, onAddToQueue, onBulkAddToQueue, onSchedule }: FavoritesPanelProps) {
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

  const handleRemove = useCallback(async (id: number, url: string) => {
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-14 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Heart className="h-8 w-8 mb-2" />
        <p className="text-sm">No favorites yet</p>
        <p className="text-xs mt-1">Use the heart icon in search results to add favorites</p>
      </div>
    )
  }

  const allSelected = selectedOrder.length === favorites.length

  return (
    <div className="overflow-hidden">
      {/* Select all toggle */}
      {favorites.length > 1 && (
        <div className="flex items-center gap-2 mb-2 px-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Select all"
          />
          <span className="text-xs text-muted-foreground">
            {allSelected ? 'Deselect all' : 'Select all'}
          </span>
        </div>
      )}

      <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1">
          {favorites.map((item) => {
            const isScheduleOpen = scheduleOpenId === item.id
            const isSelected = selectedSet.has(item.url)
            const selectionIndex = selectedOrder.indexOf(item.url)

            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 p-2 rounded-lg transition-colors min-w-0 ${
                  isSelected ? 'bg-muted/70' : 'hover:bg-muted/50'
                }`}
              >
                <SelectableCheckbox
                  checked={isSelected}
                  selectionIndex={selectionIndex}
                  onCheckedChange={() => toggleSelect(item.url)}
                  ariaLabel={`Select ${item.title}`}
                  className="self-center"
                />

                {/* Thumbnail */}
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  width={56}
                  height={40}
                  className="h-10 w-14 rounded object-cover shrink-0 bg-muted self-center"
                />

                {/* Title + Duration + Actions */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(item.duration)}
                    </p>
                    <div className="flex-1" />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary-foreground hover:bg-primary"
                        onClick={() => onPlay({ url: item.url, title: item.title, thumbnail: item.thumbnail, duration: item.duration })}
                        aria-label="Play now"
                        title="Play now"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onAddToQueue({ url: item.url, title: item.title, thumbnail: item.thumbnail, duration: item.duration })}
                        aria-label="Add to Up Next"
                        title="Add to Up Next"
                      >
                        <ListPlus className="h-4 w-4" />
                      </Button>
                      <Popover
                        open={isScheduleOpen}
                        onOpenChange={(open) => setScheduleOpenId(open ? item.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Schedule"
                            title="Schedule"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-auto p-3">
                          <ScheduleTimePicker
                            songCount={1}
                            totalDuration={item.duration || 0}
                            onSchedule={(scheduledAt) => handleSchedule(item, scheduledAt)}
                            onCancel={() => setScheduleOpenId(null)}
                            timezone={timezone}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(item.id, item.url)}
                        aria-label="Remove from favorites"
                        title="Remove from favorites"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bulk action bar */}
      {selectedOrder.length > 0 && (
        <BulkActionBar
          selectedCount={selectedOrder.length}
          songCount={selectedItems.length}
          totalDuration={totalDuration}
          scheduleOpen={bulkScheduleOpen}
          onScheduleOpenChange={setBulkScheduleOpen}
          onClear={clearSelection}
          onQueueAll={handleBulkQueue}
          onSchedule={handleBulkSchedule}
          timezone={timezone}
        />
      )}
    </div>
  )
}
