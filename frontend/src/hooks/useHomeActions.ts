import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { handleApiError, toMediaItem } from '@/lib/utils'
import { emitQueueUpdated, emitScheduleUpdated } from '@/lib/events'
import { toggleFavorite } from '@/hooks/useFavoriteToggle'
import { useAuth } from '@/hooks/useAuth'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import * as api from '@/lib/api'
import type { SearchResult } from '@/types'

export function useHomeActions() {
  const router = useRouter()
  const { user, loading: authLoading, setUser } = useAuth()
  const { activeSpeakerId } = useSpeaker()
  const { searchResultCount } = useAccessibility()
  const [activeTab, setActiveTab] = useState('queue')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [favoritedUrls, setFavoritedUrls] = useState<Map<string, number>>(new Map())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detailState, setDetailState] = useState<{ open: boolean; item: SearchResult | null; queueId: number | null }>({ open: false, item: null, queueId: null })
  const [searchMode, setSearchMode] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchMode) {
      searchInputRef.current?.focus()
    }
  }, [searchMode])

  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true)
    setHasSearched(true)
    try {
      const isUrl = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)/.test(query)
      let results: SearchResult[]
      if (isUrl) {
        const result = await api.resolveUrl(query)
        results = [result]
      } else {
        results = await api.search(query, searchResultCount)
      }
      setSearchResults(results)

      if (results.length > 0) {
        try {
          const urls = results.map((r) => r.url)
          const check = await api.checkBulkFavorites(urls)
          const map = new Map<string, number>()
          for (const [url, id] of Object.entries(check)) {
            if (id !== null) map.set(url, id)
          }
          setFavoritedUrls(map)
        } catch {
          setFavoritedUrls(new Map())
        }
      }
    } catch (err) {
      handleApiError(err, 'Search failed')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchResultCount])

  const handlePlay = useCallback(async (item: SearchResult) => {
    try {
      const result = await api.play({
        ...toMediaItem(item),
        speaker_id: activeSpeakerId ?? undefined,
      })
      toast.success(`Playing: ${result.title}`)
      setSearchResults([])
      setHasSearched(false)
      setSearchMode(false)
      setSearchValue('')
      emitQueueUpdated()
    } catch (err) {
      handleApiError(err, 'Play failed')
    }
  }, [activeSpeakerId])

  const handleAddToQueue = useCallback(async (item: SearchResult) => {
    try {
      const result = await api.addToQueue({
        ...toMediaItem(item),
        speaker_id: activeSpeakerId ?? undefined,
      })
      toast.success(`Added to Up Next: ${result.title}`)
      emitQueueUpdated()
    } catch (err) {
      handleApiError(err, 'Failed to add')
    }
  }, [activeSpeakerId])

  const handleBulkAddToQueue = useCallback(async (items: SearchResult[]) => {
    try {
      const result = await api.bulkAddToQueue(
        items.map(toMediaItem),
        activeSpeakerId ?? undefined,
      )
      toast.success(`Added ${result.length} song${result.length !== 1 ? 's' : ''} to Up Next`)
      emitQueueUpdated()
    } catch (err) {
      handleApiError(err, 'Failed to add')
    }
  }, [activeSpeakerId])

  const handleSchedule = useCallback(async (items: SearchResult[], scheduledAt: string) => {
    let offset = 0
    let successCount = 0
    const groupId = items.length > 1 ? crypto.randomUUID() : undefined
    for (const item of items) {
      const time = new Date(new Date(scheduledAt).getTime() + offset * 1000)
      try {
        await api.createSchedule({
          ...toMediaItem(item),
          scheduled_at: time.toISOString(),
          group_id: groupId,
          speaker_id: activeSpeakerId ?? undefined,
        })
        successCount++
      } catch (err) {
        toast.error(`Failed to schedule: ${item.title}`)
      }
      offset += item.duration || 0
    }
    if (successCount > 0) {
      toast.success(`Scheduled ${successCount} song${successCount !== 1 ? 's' : ''}`)
      emitScheduleUpdated()
    }
  }, [activeSpeakerId])

  const handleToggleFavorite = useCallback(async (item: SearchResult) => {
    const existingId = favoritedUrls.get(item.url) ?? null
    await toggleFavorite({
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration,
      currentFavoriteId: existingId,
      onOptimistic: (id) => setFavoritedUrls((prev) => {
        const next = new Map(prev)
        if (id !== null) next.set(item.url, id)
        else next.delete(item.url)
        return next
      }),
      onRollback: (id) => setFavoritedUrls((prev) => {
        const next = new Map(prev)
        if (id !== null) next.set(item.url, id)
        else next.delete(item.url)
        return next
      }),
      onSuccess: () => {},
    })
  }, [favoritedUrls])

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchValue.trim()
    if (!trimmed) return
    handleSearch(trimmed)
  }, [searchValue, handleSearch])

  const exitSearchMode = useCallback(() => {
    setSearchMode(false)
    setSearchValue('')
    setSearchResults([])
    setHasSearched(false)
  }, [])

  const handleOpenDetail = useCallback((item: SearchResult, queueId?: number) => {
    setDetailState({ open: true, item, queueId: queueId ?? null })
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailState({ open: false, item: null, queueId: null })
  }, [])

  const handlePlayFromQueue = useCallback(async (id: number) => {
    try {
      const item = await api.playFromQueue(id)
      toast.success(`Playing: ${item.title}`)
      emitQueueUpdated()
    } catch (err) {
      handleApiError(err, 'Play failed')
    }
  }, [])

  const handleFavoriteChanged = useCallback((url: string, favoriteId: number | null) => {
    setFavoritedUrls((prev) => {
      const next = new Map(prev)
      if (favoriteId !== null) {
        next.set(url, favoriteId)
      } else {
        next.delete(url)
      }
      return next
    })
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // ignore logout errors
    }
    setUser(null)
    router.push('/login')
  }, [setUser, router])

  return {
    // Auth
    user,
    authLoading,
    // Search
    searchMode,
    searchValue,
    searchResults,
    isSearching,
    hasSearched,
    searchInputRef,
    setSearchMode,
    setSearchValue,
    handleSearchSubmit,
    exitSearchMode,
    // Tabs
    activeTab,
    setActiveTab,
    // Actions
    handlePlay,
    handleAddToQueue,
    handleBulkAddToQueue,
    handleSchedule,
    handleToggleFavorite,
    handlePlayFromQueue,
    handleFavoriteChanged,
    handleLogout,
    // Favorites
    favoritedUrls,
    // Detail dialog
    detailState,
    handleOpenDetail,
    handleDetailOpenChange,
    // Settings
    settingsOpen,
    setSettingsOpen,
  }
}
