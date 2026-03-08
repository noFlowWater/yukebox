'use client'

import Image from 'next/image'
import { Play, ListPlus, Clock, Heart, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'
import { CommentItem } from '@/components/CommentItem'
import { MusicSection } from '@/components/MusicSection'
import { formatDuration } from '@/lib/utils'
import { useMusicDetail } from '@/hooks/useMusicDetail'
import type { SearchResult } from '@/types'

interface MusicDetailDialogProps {
  open: boolean
  item: SearchResult | null
  queueId: number | null
  onOpenChange: (open: boolean) => void
  onPlay: (item: SearchResult) => void
  onPlayFromQueue: (id: number) => void
  onAddToQueue: (item: SearchResult) => void
  onSchedule: (items: SearchResult[], scheduledAt: string) => void
  onFavoriteChanged: (url: string, favoriteId: number | null) => void
}

export function MusicDetailDialog({
  open,
  item,
  queueId,
  onOpenChange,
  onPlay,
  onPlayFromQueue,
  onAddToQueue,
  onSchedule,
  onFavoriteChanged,
}: MusicDetailDialogProps) {
  const {
    details, isLoading, error, favoriteId, thumbnailFailed,
    descExpanded, descOverflows, scheduleOpen, comments,
    commentsLoading, pinnedExpanded, pinnedOverflows, music,
    nestedItem, nestedOpen, timezone, thumbnailUrl,
    hasComments, visibleTopComments,
    descRef, pinnedRef,
    setThumbnailFailed, setDescExpanded, setScheduleOpen,
    setPinnedExpanded, setNestedOpen,
    fetchData, handlePlayAction, handleQueueAction,
    handleScheduleAction, handleFavoriteToggle,
    handleOpenTrackDetail, formatUploadDate,
  } = useMusicDetail({
    open, item, queueId,
    onPlay, onPlayFromQueue, onAddToQueue, onSchedule,
    onOpenChange, onFavoriteChanged,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 sm:rounded-2xl border-border/50">
        <DialogTitle className="sr-only">{item?.title || 'Music Details'}</DialogTitle>

        {isLoading ? (
          <>
            <Skeleton className="w-full aspect-video" />
            <div className="p-4 flex flex-col gap-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-9 rounded" />
                ))}
              </div>
            </div>
          </>
        ) : error ? (
          <div className="p-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">Failed to load details</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => item?.url && fetchData(item.url)}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : details ? (
          <>
            {/* Thumbnail */}
            <div className="relative w-full aspect-video bg-muted">
              <Image
                src={thumbnailUrl}
                alt={details.title || item?.title || ''}
                fill
                className="object-cover"
                onError={() => {
                  if (!thumbnailFailed) setThumbnailFailed(true)
                }}
              />
            </div>

            <div className="p-4 flex flex-col gap-3 min-w-0">
              {/* Title */}
              <h2 className="text-base font-display font-semibold leading-snug break-words">
                {details.title || item?.title}
              </h2>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {details.channel && <span>{details.channel}</span>}
                {details.view_count > 0 && (
                  <span>{details.view_count.toLocaleString()} views</span>
                )}
                {details.upload_date && (
                  <span>{formatUploadDate(details.upload_date)}</span>
                )}
                <span>{formatDuration(details.duration || item?.duration || 0)}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="default"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handlePlayAction}
                  aria-label="Play now"
                  title="Play now"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleQueueAction}
                  aria-label="Add to Up Next"
                  title="Add to Up Next"
                >
                  <ListPlus className="h-4 w-4" />
                </Button>
                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Schedule"
                      title="Schedule"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-3">
                    <ScheduleTimePicker
                      songCount={1}
                      totalDuration={item?.duration || 0}
                      onSchedule={handleScheduleAction}
                      onCancel={() => setScheduleOpen(false)}
                      timezone={timezone}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-9 w-9 ${
                    favoriteId !== null
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-muted-foreground hover:text-red-500'
                  }`}
                  onClick={handleFavoriteToggle}
                  aria-label={favoriteId !== null ? 'Remove from favorites' : 'Add to favorites'}
                  title={favoriteId !== null ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`h-4 w-4 ${favoriteId !== null ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => item?.url && window.open(item.url, '_blank', 'noopener')}
                  aria-label="Open on YouTube"
                  title="Open on YouTube"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              {/* Music in this video */}
              {music && music.count > 0 && (
                <MusicSection
                  music={music}
                  onPlay={onPlay}
                  onAddToQueue={onAddToQueue}
                  onSchedule={onSchedule}
                  onFavoriteChanged={onFavoriteChanged}
                  onOpenTrackDetail={handleOpenTrackDetail}
                  timezone={timezone}
                />
              )}

              {/* Description */}
              {details.description && (
                <div className="pt-2 border-t border-border">
                  <p
                    ref={descRef}
                    className={`text-sm text-muted-foreground whitespace-pre-line break-words ${
                      descExpanded ? '' : 'line-clamp-3'
                    }`}
                  >
                    {details.description}
                  </p>
                  {descOverflows && (
                    <button
                      className="mt-1 text-xs text-primary hover:underline flex items-center gap-0.5"
                      onClick={() => setDescExpanded(!descExpanded)}
                    >
                      {descExpanded ? (
                        <>Show less <ChevronUp className="h-3 w-3" /></>
                      ) : (
                        <>Show more <ChevronDown className="h-3 w-3" /></>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Comments */}
              {commentsLoading && (
                <div className="pt-2 border-t border-border flex flex-col gap-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  ))}
                </div>
              )}
              {hasComments && comments && (
                <div className="pt-2 border-t border-border flex flex-col gap-3">
                  {comments.pinned && (
                    <CommentItem
                      comment={comments.pinned}
                      pinned
                      expanded={pinnedExpanded}
                      overflows={pinnedOverflows}
                      textRef={pinnedRef}
                      onToggle={() => setPinnedExpanded(!pinnedExpanded)}
                    />
                  )}
                  {visibleTopComments.map((c, i) => (
                    <CommentItem key={i} comment={c} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>

      {/* Nested track detail dialog */}
      {nestedItem && (
        <MusicDetailDialog
          open={nestedOpen}
          item={nestedItem}
          queueId={null}
          onOpenChange={setNestedOpen}
          onPlay={onPlay}
          onPlayFromQueue={onPlayFromQueue}
          onAddToQueue={onAddToQueue}
          onSchedule={onSchedule}
          onFavoriteChanged={onFavoriteChanged}
        />
      )}
    </Dialog>
  )
}
