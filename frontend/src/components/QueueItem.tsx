'use client'

import { Check, GripVertical, Pause, Play, Square, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/StatusPill'
import { ClickableThumbnail } from '@/components/ClickableThumbnail'
import { ClickableTitle } from '@/components/ClickableTitle'
import { formatDuration, toMediaItem } from '@/lib/utils'
import type { QueueItem as QueueItemType } from '@/types'

interface QueueItemProps {
  item: QueueItemType
  index: number
  playbackPaused: boolean
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  onPlay: (id: number) => void
  onPause: () => void
  onStop: () => void
  onRemove: (id: number) => void
  onOpenDetail: (item: { url: string; title: string; thumbnail: string; duration: number }, queueId: number) => void
}

export function QueueItem({
  item, index, playbackPaused,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onPlay, onPause, onStop, onRemove, onOpenDetail,
}: QueueItemProps) {
  const isActive = item.status === 'playing'
  const isPlaying = isActive && !playbackPaused
  const isPaused = item.status === 'paused' || (isActive && playbackPaused)
  const isPlayed = item.status === 'played'
  const canDrag = !isPlaying && !isPaused

  return (
    <li
      draggable={canDrag}
      onDragStart={canDrag ? (e) => onDragStart(e, index) : undefined}
      onDragOver={canDrag ? (e) => onDragOver(e, index) : undefined}
      onDragLeave={canDrag ? onDragLeave : undefined}
      onDrop={canDrag ? (e) => onDrop(e, index) : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      className={`flex items-start gap-3 p-2.5 rounded-xl transition-all min-w-0 ${
        isPlaying
          ? 'bg-success/10 border border-success/30 shadow-sm shadow-success/10'
          : isPaused
            ? 'bg-warning/5 border border-warning/20'
            : `cursor-grab active:cursor-grabbing hover:bg-card/80 ${
                isDragging ? 'opacity-30 scale-95' : ''
              } ${
                isDragOver
                  ? 'border-t-2 border-primary'
                  : 'border-t-2 border-transparent'
              }`
      }`}
    >
      {/* Drag handle or status indicator */}
      {isPlaying ? (
        <span className="inline-block w-4 h-4 shrink-0 flex items-center justify-center self-center">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        </span>
      ) : isPaused ? (
        <Pause className="h-4 w-4 text-warning shrink-0 self-center" />
      ) : isPlayed ? (
        <Check className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
      ) : (
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
      )}

      {/* Thumbnail — clickable */}
      <ClickableThumbnail
        onClick={() => onOpenDetail(toMediaItem(item), item.id)}
        ariaLabel={`View details: ${item.title}`}
      >
        <Image src={item.thumbnail} alt={item.title} width={56} height={40} className="h-10 w-14 rounded object-cover bg-muted" />
      </ClickableThumbnail>

      {/* Title + Duration/Status + Actions */}
      <div className="flex-1 min-w-0">
        <ClickableTitle onClick={() => onOpenDetail(toMediaItem(item), item.id)}>
          {item.title}
        </ClickableTitle>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">
            {formatDuration(item.duration)}
          </p>
          {isPlaying && (
            <StatusPill variant="success">Now playing</StatusPill>
          )}
          {isPaused && (
            <StatusPill variant="warning">paused</StatusPill>
          )}
          <div className="flex-1" />

          {/* Actions — playing item: pause + stop */}
          {isPlaying && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onPause}
                title="Pause"
              >
                <Pause className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onStop}
                title="Stop"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Actions — paused item: resume + remove */}
          {isPaused && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => isActive ? onPause() : onPlay(item.id)}
                title="Resume"
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onRemove(item.id)}
                title="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Actions — pending/played item: play + remove */}
          {!isPlaying && !isPaused && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPlay(item.id)}
                title="Play now"
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onRemove(item.id)}
                title="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
