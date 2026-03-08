'use client'

import { ListMusic, Shuffle, Trash2, ArrowRight, Repeat, Repeat1 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QueueItem } from '@/components/QueueItem'
import { EmptyState } from '@/components/EmptyState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { useQueuePanel } from '@/hooks/useQueuePanel'
import type { PlaybackMode } from '@/types'

const MODE_CONFIG: Record<PlaybackMode, { icon: typeof ArrowRight; label: string }> = {
  sequential: { icon: ArrowRight, label: 'In order' },
  'repeat-all': { icon: Repeat, label: 'Repeat all' },
  'repeat-one': { icon: Repeat1, label: 'Repeat one' },
  shuffle: { icon: Shuffle, label: 'Shuffle' },
}

interface QueuePanelProps {
  active?: boolean
  onOpenDetail: (item: { url: string; title: string; thumbnail: string; duration: number }, queueId: number) => void
}

export function QueuePanel({ active = true, onOpenDetail }: QueuePanelProps) {
  const {
    queue, isLoading, dragIndex, overIndex, playbackMode,
    playbackPaused, hasPending,
    handlePlay, handlePause, handleStop, handleModeChange, handleClearAll,
    handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd,
    handleRemove,
  } = useQueuePanel(active)

  if (isLoading) return <ListSkeleton />

  if (queue.length === 0) {
    return <EmptyState icon={<ListMusic className="h-8 w-8 mb-2" />} title="Nothing up next" />
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

      <div className="overflow-x-hidden">
        <ul className="flex flex-col gap-1 stagger">
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
