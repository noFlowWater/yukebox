import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { createSessionCache } from '@/lib/sessionCache'
import { toggleFavorite } from '@/hooks/useFavoriteToggle'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import * as api from '@/lib/api'
import type { SearchResult, YoutubeDetails, VideoComments, VideoMusic } from '@/types'

const detailsCache = createSessionCache<YoutubeDetails>(100)
const commentsCache = createSessionCache<VideoComments>(100)
const musicCache = createSessionCache<VideoMusic>(100)

interface UseMusicDetailParams {
  open: boolean
  item: SearchResult | null
  queueId: number | null
  onPlay: (item: SearchResult) => void
  onPlayFromQueue: (id: number) => void
  onAddToQueue: (item: SearchResult) => void
  onSchedule: (items: SearchResult[], scheduledAt: string) => void
  onOpenChange: (open: boolean) => void
  onFavoriteChanged: (url: string, favoriteId: number | null) => void
}

export function useMusicDetail({
  open,
  item,
  queueId,
  onPlay,
  onPlayFromQueue,
  onAddToQueue,
  onSchedule,
  onOpenChange,
  onFavoriteChanged,
}: UseMusicDetailParams) {
  const { timezone, commentCount } = useAccessibility()
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
  const [music, setMusic] = useState<VideoMusic | null>(null)
  const [nestedItem, setNestedItem] = useState<SearchResult | null>(null)
  const [nestedOpen, setNestedOpen] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)
  const pinnedRef = useRef<HTMLParagraphElement>(null)

  const fetchData = useCallback(async (url: string) => {
    setIsLoading(true)
    setError(false)
    setDetails(null)
    setThumbnailFailed(false)
    setDescExpanded(false)

    const cached = detailsCache.get(url)

    const [detailsResult, favResult] = await Promise.allSettled([
      cached ? Promise.resolve(cached) : api.getYoutubeDetails(url),
      api.checkBulkFavorites([url]),
    ])

    if (detailsResult.status === 'fulfilled') {
      const data = detailsResult.value
      setDetails(data)
      if (!cached) detailsCache.set(url, data)
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
      setMusic(null)
      setNestedItem(null)
      setNestedOpen(false)
    }
  }, [open, item?.url, fetchData])

  // Fetch comments separately — must NOT block main loading
  useEffect(() => {
    if (!details || !item?.url) return

    const cached = commentsCache.get(item.url)
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
          commentsCache.set(item.url, data)
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

  // Fetch music — lazy after details load
  useEffect(() => {
    if (!details || !item?.url) return

    const cached = musicCache.get(item.url)
    if (cached) {
      setMusic(cached)
      return
    }

    const controller = new AbortController()

    api.getVideoMusic(item.url, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setMusic(data)
          musicCache.set(item.url, data)
        }
      })
      .catch(() => { /* silently hide on error */ })

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
    await toggleFavorite({
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration,
      currentFavoriteId: favoriteId,
      onOptimistic: (id) => setFavoriteId(id),
      onRollback: (id) => setFavoriteId(id),
      onSuccess: (url, favId) => onFavoriteChanged(url, favId),
    })
  }, [item, favoriteId, onFavoriteChanged])

  const handleOpenTrackDetail = useCallback((trackItem: SearchResult) => {
    setNestedItem(trackItem)
    setNestedOpen(true)
  }, [])

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

  const hasComments = comments && !commentsLoading && (comments.pinned || comments.top.length > 0)
  const visibleTopComments = comments?.top.slice(0, commentCount) ?? []

  return {
    // Data
    details,
    isLoading,
    error,
    favoriteId,
    thumbnailFailed,
    descExpanded,
    descOverflows,
    scheduleOpen,
    comments,
    commentsLoading,
    pinnedExpanded,
    pinnedOverflows,
    music,
    nestedItem,
    nestedOpen,
    timezone,
    thumbnailUrl,
    hasComments,
    visibleTopComments,
    // Refs
    descRef,
    pinnedRef,
    // Setters
    setThumbnailFailed,
    setDescExpanded,
    setScheduleOpen,
    setPinnedExpanded,
    setNestedOpen,
    // Actions
    fetchData,
    handlePlayAction,
    handleQueueAction,
    handleScheduleAction,
    handleFavoriteToggle,
    handleOpenTrackDetail,
    formatUploadDate,
  }
}
