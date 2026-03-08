'use client'

import { ListMusic, Shuffle, Trash2, ArrowRight, Repeat, Repeat1 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { QueueItem } from '@/components/QueueItem'
import { useQueuePanel } from '@/hooks/useQueuePanel'
import type { PlaybackMode } from '@/types'

const MODE_CONFIG: Record<PlaybackMode, { icon: typeof ArrowRight; label: string }> = {
  sequential: { icon: ArrowRight, label: 'In order' },
  'repeat-all': { icon: Repeat, label: 'Repeat all' },
  'repeat-one': { icon: Repeat1, label: 'Repeat one' },
  shuffle: { icon: Shuffle, label: 'Shuffle' },
}

interface QueuePanelProps {
  onOpenDetail: (item: { url: string; title: string; thumbnail: string; duration: number }, queueId: number) => void
}

export function QueuePanel({ onOpenDetail }: QueuePanelProps) {
  const {
    queue, isLoading, dragIndex, overIndex, playbackMode,
    playbackPaused, hasPending,
    handlePlay, handlePause, handleStop, handleModeChange, handleClearAll,
    handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd,
    handleRemove,
  } = useQueuePanel()

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

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ListMusic className="h-8 w-8 mb-2" />
        <p className="text-sm">Nothing up next</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      {/* Queue header */}
      <div className="flex items-center justify-end gap-1 py-2">
        {hasPending && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleClearAll}
            title="Clear upcoming"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear all
          </Button>
        )}
        {(() => {
          const config = MODE_CONFIG[playbackMode]
          const Icon = config.icon
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleModeChange}
              title={config.label}
            >
              <Icon className="h-4 w-4 mr-1.5" />
              {config.label}
            </Button>
          )
        })()}
      </div>

      <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1">
          {queue.map((item, index) => (
            <QueueItem
              key={item.id}
              item={item}
              index={index}
              playbackPaused={playbackPaused}
              isDragging={dragIndex === index}
              isDragOver={overIndex === index && dragIndex !== index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onRemove={handleRemove}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
