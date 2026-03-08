'use client'

import {
  LogOut, Shield, Heart, Loader2, User, Settings, Search,
  ArrowLeft, X, ListMusic, Clock,
} from 'lucide-react'
import Image from 'next/image'
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
import { BottomSheet } from '@/components/BottomSheet'
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
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden overscroll-none">
      {/* ── Top bar: minimal ── */}
      <header className="flex items-center justify-between px-4 h-12 shrink-0 relative z-20">
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="YukeBox" width={18} height={18} />
          <span className="font-display text-sm font-bold tracking-wide uppercase text-muted-foreground">
            YukeBox
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setSearchMode(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
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
      </header>

      {/* ── Speaker selector ── */}
      <SpeakerBar />

      {/* ── Hero Player — centered between speaker bar and bottom sheet peek ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden pb-[148px]">
        <PlayerBar onSearchClick={() => setSearchMode(true)} />
      </div>

      {/* ── Bottom Sheet with Queue/Schedule/Favorites ── */}
      <BottomSheet activeTab={activeTab} onTabChange={setActiveTab}>
        <div className={activeTab !== 'queue' ? 'hidden' : undefined}>
          <QueuePanel active={activeTab === 'queue'} onOpenDetail={(item, queueId) => handleOpenDetail(item, queueId)} />
        </div>
        <div className={activeTab !== 'schedule' ? 'hidden' : undefined}>
          <SchedulePanel active={activeTab === 'schedule'} onOpenDetail={handleOpenDetail} />
        </div>
        <div className={activeTab !== 'favorites' ? 'hidden' : undefined}>
          <FavoritesPanel
            onPlay={handlePlay}
            onAddToQueue={handleAddToQueue}
            onBulkAddToQueue={handleBulkAddToQueue}
            onSchedule={handleSchedule}
            onOpenDetail={handleOpenDetail}
          />
        </div>
      </BottomSheet>

      {/* ── Search overlay ── */}
      {searchMode && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-slide-overlay">
          {/* Search header */}
          <div className="flex items-center gap-2 px-4 h-14 shrink-0 border-b border-border/50">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={exitSearchMode}
              aria-label="Close search"
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
                className="pl-10 h-10 rounded-full bg-card border-border/50 text-sm"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchSubmit()
                }}
                disabled={isSearching}
              />
              {searchValue && !isSearching && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchValue('')}
                  aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Search results */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <div className="max-w-2xl mx-auto">
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
            </div>
          </div>
        </div>
      )}

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
