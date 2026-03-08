'use client'

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
import { MusicDetailDialog } from '@/components/MusicDetailDialog'
import { useHomeActions } from '@/hooks/useHomeActions'

export default function Home() {
  const {
    user, authLoading,
    searchMode, searchValue, searchResults, isSearching,
    hasSearched, searchInputRef, setSearchMode, setSearchValue,
    handleSearchSubmit, exitSearchMode,
    activeTab, setActiveTab,
    handlePlay, handleAddToQueue, handleBulkAddToQueue,
    handleSchedule, handleToggleFavorite, handlePlayFromQueue,
    handleFavoriteChanged, handleLogout,
    favoritedUrls,
    detailState, handleOpenDetail, handleDetailOpenChange,
    settingsOpen, setSettingsOpen,
  } = useHomeActions()

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
                      <DropdownMenuItem onClick={() => window.location.href = '/admin'}>
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
            onOpenDetail={handleOpenDetail}
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
            <QueuePanel onOpenDetail={(item, queueId) => handleOpenDetail(item, queueId)} />
          </TabsContent>
          <TabsContent value="schedule" forceMount className="data-[state=inactive]:hidden">
            <SchedulePanel onOpenDetail={handleOpenDetail} />
          </TabsContent>
          <TabsContent value="favorites" forceMount className="data-[state=inactive]:hidden">
            <FavoritesPanel
              onPlay={handlePlay}
              onAddToQueue={handleAddToQueue}
              onBulkAddToQueue={handleBulkAddToQueue}
              onSchedule={handleSchedule}
              onOpenDetail={handleOpenDetail}
            />
          </TabsContent>
        </Tabs>
      </main>

      <PlayerBar />

      <MusicDetailDialog
        open={detailState.open}
        item={detailState.item}
        queueId={detailState.queueId}
        onOpenChange={handleDetailOpenChange}
        onPlay={handlePlay}
        onPlayFromQueue={handlePlayFromQueue}
        onAddToQueue={handleAddToQueue}
        onSchedule={handleSchedule}
        onFavoriteChanged={handleFavoriteChanged}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
