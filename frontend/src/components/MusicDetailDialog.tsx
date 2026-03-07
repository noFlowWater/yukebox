'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Play, ListPlus, Clock, Heart, ExternalLink, RefreshCw, ChevronDown, ChevronUp, Pin, ThumbsUp, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'
import { formatDuration, handleApiError } from '@/lib/utils'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import * as api from '@/lib/api'
import type { SearchResult, YoutubeDetails, VideoComments, VideoComment } from '@/types'

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

// Session-level cache for YouTube details (max 100 entries)
const detailsCache = new Map<string, YoutubeDetails>()
const DETAILS_CACHE_MAX = 100

// Session-level cache for video comments (max 100 entries)
const commentsCache = new Map<string, VideoComments>()
const COMMENTS_CACHE_MAX = 100

function getCachedComments(url: string): VideoComments | undefined {
  return commentsCache.get(url)
}

function setCachedComments(url: string, data: VideoComments): void {
  if (commentsCache.size >= COMMENTS_CACHE_MAX) {
    const oldest = commentsCache.keys().next().value
    if (oldest !== undefined) commentsCache.delete(oldest)
  }
  commentsCache.set(url, data)
}

function getCachedDetails(url: string): YoutubeDetails | undefined {
  return detailsCache.get(url)
}

function setCachedDetails(url: string, data: YoutubeDetails): void {
  if (detailsCache.size >= DETAILS_CACHE_MAX) {
    const oldest = detailsCache.keys().next().value
    if (oldest !== undefined) detailsCache.delete(oldest)
  }
  detailsCache.set(url, data)
}

function CommentItem({
  comment,
  pinned = false,
  expanded = false,
  overflows = false,
  textRef,
  onToggle,
}: {
  comment: VideoComment
  pinned?: boolean
  expanded?: boolean
  overflows?: boolean
  textRef?: React.RefObject<HTMLParagraphElement | null>
  onToggle?: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {pinned ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Pin className="h-3 w-3" />
            Pinned
          </span>
        ) : (
          <MessageSquare className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-xs font-semibold">{comment.author}</span>
        {comment.like_count > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <ThumbsUp className="h-3 w-3" />
            {comment.like_count.toLocaleString()}
          </span>
        )}
      </div>
      <p
        ref={textRef}
        className={`text-sm text-muted-foreground whitespace-pre-line ${
          pinned && !expanded ? 'line-clamp-4' : pinned ? '' : 'line-clamp-3'
        }`}
      >
        {comment.text}
      </p>
      {pinned && overflows && onToggle && (
        <button
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
          onClick={onToggle}
        >
          {expanded ? (
            <>Show less <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Show more <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  )
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
  const { timezone } = useAccessibility()
  const [details, setDetails] = useState<YoutubeDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const [favoriteId, setFavoriteId] = useState<number | null>(null)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [descOverflows, setDescOverflows] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [comments, setComments] = useState<VideoComments | null>(null)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [pinnedExpanded, setPinnedExpanded] = useState(false)
  const [pinnedOverflows, setPinnedOverflows] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)
  const pinnedRef = useRef<HTMLParagraphElement>(null)

  const fetchData = useCallback(async (url: string) => {
    setIsLoading(true)
    setError(false)
    setDetails(null)
    setThumbnailFailed(false)
    setDescExpanded(false)

    const cached = getCachedDetails(url)

    const [detailsResult, favResult] = await Promise.allSettled([
      cached ? Promise.resolve(cached) : api.getYoutubeDetails(url),
      api.checkBulkFavorites([url]),
    ])

    if (detailsResult.status === 'fulfilled') {
      const data = detailsResult.value
      setDetails(data)
      if (!cached) setCachedDetails(url, data)
    } else {
      setError(true)
    }

    if (favResult.status === 'fulfilled') {
      const check = favResult.value
      const id = check[url] ?? null
      setFavoriteId(id)
    } else {
      setFavoriteId(null)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (open && item?.url) {
      fetchData(item.url)
    }
    if (!open) {
      setDetails(null)
      setFavoriteId(null)
      setScheduleOpen(false)
      setComments(null)
      setCommentsLoading(false)
      setPinnedExpanded(false)
      setPinnedOverflows(false)
    }
  }, [open, item?.url, fetchData])

  // Fetch comments in a separate useEffect — must NOT be inside fetchData
  // to avoid blocking setIsLoading(false) during the slow comment extraction
  useEffect(() => {
    if (!details || !item?.url) return

    const cached = getCachedComments(item.url)
    if (cached) {
      setComments(cached)
      return
    }

    const controller = new AbortController()
    setCommentsLoading(true)
    setPinnedExpanded(false)
    setPinnedOverflows(false)

    api.getVideoComments(item.url, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setComments(data)
          setCachedComments(item.url, data)
        }
      })
      .catch(() => { /* silently hide on error */ })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCommentsLoading(false)
        }
      })

    return () => controller.abort()
  }, [details, item?.url])

  // Check if description overflows 3 lines
  useEffect(() => {
    if (details?.description && descRef.current) {
      const el = descRef.current
      setDescOverflows(el.scrollHeight > el.clientHeight + 1)
    }
  }, [details?.description])

  // Check if pinned comment overflows 4 lines
  useEffect(() => {
    if (comments?.pinned?.text && pinnedRef.current) {
      const el = pinnedRef.current
      setPinnedOverflows(el.scrollHeight > el.clientHeight + 1)
    }
  }, [comments?.pinned?.text])

  const handlePlayAction = useCallback(() => {
    if (!item) return
    if (queueId !== null) {
      onPlayFromQueue(queueId)
    } else {
      onPlay(item)
    }
    onOpenChange(false)
  }, [item, queueId, onPlay, onPlayFromQueue, onOpenChange])

  const handleQueueAction = useCallback(() => {
    if (!item) return
    onAddToQueue(item)
    toast.success(`Added to Up Next: ${item.title}`)
  }, [item, onAddToQueue])

  const handleScheduleAction = useCallback((scheduledAt: string) => {
    if (!item) return
    onSchedule([item], scheduledAt)
    setScheduleOpen(false)
  }, [item, onSchedule])

  const handleFavoriteToggle = useCallback(async () => {
    if (!item) return
    if (favoriteId !== null) {
      const prevId = favoriteId
      setFavoriteId(null)
      try {
        await api.removeFavorite(prevId)
        onFavoriteChanged(item.url, null)
        window.dispatchEvent(new Event('favorites-updated'))
      } catch (err) {
        setFavoriteId(prevId)
        handleApiError(err, 'Failed to remove favorite')
      }
    } else {
      setFavoriteId(-1)
      try {
        const fav = await api.addFavorite({
          url: item.url,
          title: item.title,
          thumbnail: item.thumbnail,
          duration: item.duration,
        })
        setFavoriteId(fav.id)
        onFavoriteChanged(item.url, fav.id)
        window.dispatchEvent(new Event('favorites-updated'))
      } catch (err) {
        setFavoriteId(null)
        handleApiError(err, 'Failed to add favorite')
      }
    }
  }, [item, favoriteId, onFavoriteChanged])

  const formatViewCount = (count: number) => {
    return count.toLocaleString()
  }

  const formatUploadDate = (date: string) => {
    if (!date) return ''
    try {
      const d = new Date(date)
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return date
    }
  }

  const thumbnailUrl = details?.thumbnail_hq
    ? (thumbnailFailed
        ? details.thumbnail_hq.replace('maxresdefault.jpg', 'hqdefault.jpg')
        : details.thumbnail_hq)
    : item?.thumbnail || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-0 gap-0 sm:rounded-lg">
        <DialogTitle className="sr-only">{item?.title || 'Music Details'}</DialogTitle>

        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            <Skeleton className="w-full aspect-video rounded" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <div className="flex gap-2 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-9 rounded" />
              ))}
            </div>
          </div>
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

            <div className="p-4 flex flex-col gap-3">
              {/* Title */}
              <h2 className="text-base font-semibold leading-snug">
                {details.title || item?.title}
              </h2>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {details.channel && <span>{details.channel}</span>}
                {details.view_count > 0 && (
                  <span>{formatViewCount(details.view_count)} views</span>
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

              {/* Description */}
              {details.description && (
                <div className="pt-2 border-t border-border">
                  <p
                    ref={descRef}
                    className={`text-sm text-muted-foreground whitespace-pre-line ${
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
                <div className="pt-2 border-t border-border flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              )}
              {comments && !commentsLoading && (comments.pinned || comments.top.length > 0) && (
                <div className="pt-2 border-t border-border flex flex-col gap-3">
                  {/* Pinned comment */}
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
                  {/* Top comments */}
                  {comments.top.map((c, i) => (
                    <CommentItem key={i} comment={c} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
