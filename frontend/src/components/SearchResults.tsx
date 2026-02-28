'use client'

import { useState, useCallback } from 'react'
import { Play, ListPlus, Clock, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'
import { SelectableCheckbox } from '@/components/SelectableCheckbox'
import { BulkActionBar } from '@/components/BulkActionBar'
import { useMultiSelect } from '@/hooks/useMultiSelect'
import Image from 'next/image'
import { formatDuration } from '@/lib/utils'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import type { SearchResult } from '@/types'

interface SearchResultsProps {
  results: SearchResult[]
  isLoading: boolean
  hasSearched: boolean
  onPlay: (item: SearchResult) => void
  onAddToQueue: (item: SearchResult) => void
  onBulkAddToQueue: (items: SearchResult[]) => void
  onSchedule: (items: SearchResult[], scheduledAt: string) => void
  favoritedUrls: Map<string, number>
  onToggleFavorite: (item: SearchResult) => void
}

export function SearchResults({
  results,
  isLoading,
  hasSearched,
  onPlay,
  onAddToQueue,
  onBulkAddToQueue,
  onSchedule,
  favoritedUrls,
  onToggleFavorite,
}: SearchResultsProps) {
  const { timezone } = useAccessibility()
  const {
    selectedOrder, selectedSet, selectedItems, totalDuration,
    toggleSelect, toggleAll, clearSelection,
  } = useMultiSelect(results)
  const [individualScheduleUrl, setIndividualScheduleUrl] = useState<string | null>(null)
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false)

  const handleBulkQueue = useCallback(() => {
    onBulkAddToQueue(selectedItems)
    clearSelection()
  }, [selectedItems, onBulkAddToQueue, clearSelection])

  const handleIndividualSchedule = useCallback(
    (item: SearchResult, scheduledAt: string) => {
      onSchedule([item], scheduledAt)
      setIndividualScheduleUrl(null)
    },
    [onSchedule]
  )

  const handleBulkSchedule = useCallback(
    (scheduledAt: string) => {
      onSchedule(selectedItems, scheduledAt)
      clearSelection()
      setBulkScheduleOpen(false)
    },
    [selectedItems, onSchedule, clearSelection]
  )

  // Reset selection when results change
  const [prevResultsLength, setPrevResultsLength] = useState(results.length)
  if (results.length !== prevResultsLength) {
    setPrevResultsLength(results.length)
    clearSelection()
  }

  if (isLoading) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-16 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!hasSearched) return null

  if (results.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground text-center">
        No results found
      </p>
    )
  }

  const allSelected = selectedOrder.length === results.length

  return (
    <div className="mt-4 overflow-hidden">
      {/* Select all toggle */}
      {results.length > 1 && (
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

      {/* Result list */}
      <ul className="flex flex-col gap-2">
        {results.map((item) => {
          const isSelected = selectedSet.has(item.url)
          const selectionIndex = selectedOrder.indexOf(item.url)
          const isScheduleOpen = individualScheduleUrl === item.url

          return (
            <li
              key={item.url}
              className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
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
                width={64}
                height={48}
                className="h-12 w-16 rounded object-cover shrink-0 bg-muted self-center"
              />

              {/* Title + Duration + Actions */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(item.duration)}
                  </p>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        favoritedUrls.has(item.url)
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-muted-foreground hover:text-red-500'
                      }`}
                      onClick={() => onToggleFavorite(item)}
                      aria-label={favoritedUrls.has(item.url) ? 'Remove from favorites' : 'Add to favorites'}
                      title={favoritedUrls.has(item.url) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className={`h-4 w-4 ${favoritedUrls.has(item.url) ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:text-primary-foreground hover:bg-primary"
                      onClick={() => onPlay(item)}
                      aria-label="Play now"
                      title="Play now"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onAddToQueue(item)}
                      aria-label="Add to queue"
                      title="Add to queue"
                    >
                      <ListPlus className="h-4 w-4" />
                    </Button>
                    <Popover
                      open={isScheduleOpen}
                      onOpenChange={(open) =>
                        setIndividualScheduleUrl(open ? item.url : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
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
                          onSchedule={(scheduledAt) =>
                            handleIndividualSchedule(item, scheduledAt)
                          }
                          onCancel={() => setIndividualScheduleUrl(null)}
                          timezone={timezone}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

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
