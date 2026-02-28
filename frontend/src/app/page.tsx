'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import { LogOut, Shield, Heart, Loader2, User, ChevronDown, Settings, Search, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchResults } from '@/components/SearchResults'
import { QueuePanel } from '@/components/QueuePanel'
import { SchedulePanel } from '@/components/SchedulePanel'
import { FavoritesPanel } from '@/components/FavoritesPanel'
import { PlayerBar } from '@/components/PlayerBar'
import { SpeakerBar } from '@/components/SpeakerBar'
import { SettingsDialog } from '@/components/SettingsDialog'
import { useAuth } from '@/hooks/useAuth'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import * as api from '@/lib/api'
import type { SearchResult } from '@/types'

export default function Home() {
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

      // Check which results are already favorited
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
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        speaker_id: activeSpeakerId ?? undefined,
      })
      toast.success(`Playing: ${result.title}`)
      setSearchResults([])
      setHasSearched(false)
      setSearchMode(false)
      setSearchValue('')
      window.dispatchEvent(new Event('queue-updated'))
    } catch (err) {
      handleApiError(err, 'Play failed')
    }
  }, [activeSpeakerId])

  const handleAddToQueue = useCallback(async (item: SearchResult) => {
    try {
      const result = await api.addToQueue({
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        speaker_id: activeSpeakerId ?? undefined,
      })
      toast.success(`Added to Up Next: ${result.title}`)
      window.dispatchEvent(new Event('queue-updated'))
    } catch (err) {
      handleApiError(err, 'Failed to add')
    }
  }, [activeSpeakerId])

  const handleBulkAddToQueue = useCallback(async (items: SearchResult[]) => {
    try {
      const result = await api.bulkAddToQueue(
        items.map((i) => ({ url: i.url, title: i.title, thumbnail: i.thumbnail, duration: i.duration })),
        activeSpeakerId ?? undefined,
      )
      toast.success(`Added ${result.length} song${result.length !== 1 ? 's' : ''} to Up Next`)
      window.dispatchEvent(new Event('queue-updated'))
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
          url: item.url,
          title: item.title,
          thumbnail: item.thumbnail,
          duration: item.duration,
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
      window.dispatchEvent(new Event('schedule-updated'))
    }
  }, [activeSpeakerId])

  const handleToggleFavorite = useCallback(async (item: SearchResult) => {
    const existingId = favoritedUrls.get(item.url)
    if (existingId !== undefined) {
      // Optimistic remove
      setFavoritedUrls((prev) => {
        const next = new Map(prev)
        next.delete(item.url)
        return next
      })
      try {
        await api.removeFavorite(existingId)
        window.dispatchEvent(new Event('favorites-updated'))
      } catch (err) {
        // Rollback
        setFavoritedUrls((prev) => new Map(prev).set(item.url, existingId))
        handleApiError(err, 'Failed to remove favorite')
      }
    } else {
      // Optimistic add (use temp id -1)
      setFavoritedUrls((prev) => new Map(prev).set(item.url, -1))
      try {
        const fav = await api.addFavorite({
          url: item.url,
          title: item.title,
          thumbnail: item.thumbnail,
          duration: item.duration,
        })
        setFavoritedUrls((prev) => new Map(prev).set(item.url, fav.id))
        window.dispatchEvent(new Event('favorites-updated'))
      } catch (err) {
        // Rollback
        setFavoritedUrls((prev) => {
          const next = new Map(prev)
          next.delete(item.url)
          return next
        })
        handleApiError(err, 'Failed to add favorite')
      }
    }
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

  const handleLogout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // ignore logout errors
    }
    setUser(null)
    router.push('/login')
  }, [setUser, router])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header — dual mode */}
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          {searchMode ? (
            /* Search mode header */
            <div className="flex items-center gap-2 w-full">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={exitSearchMode}
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search or paste YouTube URL..."
                  className="pl-10"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchSubmit()
                  }}
                  disabled={isSearching}
                />
              </div>
            </div>
          ) : (
            /* Default header */
            <>
              <div className="flex items-center gap-2">
                <Image src="/icon.svg" alt="YukeBox" width={20} height={20} />
                <span className="text-base font-semibold">YukeBox</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSearchMode(true)}
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm max-w-[100px] truncate">{user?.username}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <span className="truncate">{user?.username}</span>
                      {user?.role === 'admin' && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Admin</Badge>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user?.role === 'admin' && (
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </header>

      <SpeakerBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">
        {searchMode && (
          <SearchResults
            results={searchResults}
            isLoading={isSearching}
            hasSearched={hasSearched}
            onPlay={handlePlay}
            onAddToQueue={handleAddToQueue}
            onBulkAddToQueue={handleBulkAddToQueue}
            onSchedule={handleSchedule}
            favoritedUrls={favoritedUrls}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className={searchMode ? 'hidden' : undefined}>
          <TabsList className="w-full">
            <TabsTrigger value="queue" className="flex-1">Up Next</TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1">Schedule</TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1">
              <Heart className="h-3.5 w-3.5 mr-1" />
              Favorites
            </TabsTrigger>
          </TabsList>
          <TabsContent value="queue" forceMount className="data-[state=inactive]:hidden">
            <QueuePanel />
          </TabsContent>
          <TabsContent value="schedule" forceMount className="data-[state=inactive]:hidden">
            <SchedulePanel />
          </TabsContent>
          <TabsContent value="favorites" forceMount className="data-[state=inactive]:hidden">
            <FavoritesPanel
              onPlay={handlePlay}
              onAddToQueue={handleAddToQueue}
              onBulkAddToQueue={handleBulkAddToQueue}
              onSchedule={handleSchedule}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Player bar — fixed bottom */}
      <PlayerBar />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
