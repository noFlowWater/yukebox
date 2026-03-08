'use client'

import { Heart, Play, ListPlus, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'
import { SelectableCheckbox } from '@/components/SelectableCheckbox'
import { BulkActionBar } from '@/components/BulkActionBar'
import { EmptyState } from '@/components/EmptyState'
import { ListSkeleton } from '@/components/ListSkeleton'
import Image from 'next/image'
import { ClickableThumbnail } from '@/components/ClickableThumbnail'
import { ClickableTitle } from '@/components/ClickableTitle'
import { formatDuration, toMediaItem } from '@/lib/utils'
import { useFavoritesPanel } from '@/hooks/useFavoritesPanel'
import type { SearchResult } from '@/types'

interface FavoritesPanelProps {
  onPlay: (item: SearchResult) => void
  onAddToQueue: (item: SearchResult) => void
  onBulkAddToQueue: (items: SearchResult[]) => void
  onSchedule: (items: SearchResult[], scheduledAt: string) => void
  onOpenDetail: (item: SearchResult) => void
}

export function FavoritesPanel({ onPlay, onAddToQueue, onBulkAddToQueue, onSchedule, onOpenDetail }: FavoritesPanelProps) {
  const {
    favorites, isLoading, scheduleOpenId, bulkScheduleOpen, timezone,
    selectedOrder, selectedSet, selectedItems, totalDuration, allSelected,
    setScheduleOpenId, setBulkScheduleOpen,
    toggleSelect, toggleAll, clearSelection,
    handleBulkQueue, handleBulkSchedule, handleRemove, handleSchedule,
  } = useFavoritesPanel({ onBulkAddToQueue, onSchedule })

  if (isLoading) return <ListSkeleton />

  if (favorites.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8 mb-2" />}
        title="No favorites yet"
        subtitle="Use the heart icon in search results to add favorites"
      />
    )
  }

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

                {/* Thumbnail — clickable */}
                <ClickableThumbnail
                  onClick={() => onOpenDetail(toMediaItem(item))}
                  ariaLabel={`View details: ${item.title}`}
                >
                  <Image src={item.thumbnail} alt={item.title} width={56} height={40} className="h-10 w-14 rounded object-cover bg-muted" />
                </ClickableThumbnail>

                {/* Title + Duration + Actions */}
                <div className="flex-1 min-w-0">
                  <ClickableTitle onClick={() => onOpenDetail(toMediaItem(item))}>
                    {item.title}
                  </ClickableTitle>
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
                        onClick={() => onPlay(toMediaItem(item))}
                        aria-label="Play now"
                        title="Play now"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onAddToQueue(toMediaItem(item))}
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
                        onClick={() => handleRemove(item.id)}
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
