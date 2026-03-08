'use client'

import { useState, useEffect } from 'react'
import { ListPlus, Clock, ChevronDown, ChevronUp, Music, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'
import { MusicTrackItem } from '@/components/MusicTrackItem'
import { toggleFavorite } from '@/hooks/useFavoriteToggle'
import * as api from '@/lib/api'
import type { SearchResult, VideoMusic, VideoMusicTrack } from '@/types'

export function MusicSection({
  music,
  onPlay,
  onAddToQueue,
  onSchedule,
  onFavoriteChanged,
  onOpenTrackDetail,
  timezone,
}: {
  music: VideoMusic
  onPlay: (item: SearchResult) => void
  onAddToQueue: (item: SearchResult) => void
  onSchedule: (items: SearchResult[], scheduledAt: string) => void
  onFavoriteChanged: (url: string, favoriteId: number | null) => void
  onOpenTrackDetail: (item: SearchResult) => void
  timezone: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [trackFavorites, setTrackFavorites] = useState<Record<string, number | null>>({})
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false)

  // Fetch favorite status for all tracks when section expands
  useEffect(() => {
    if (!expanded || music.tracks.length === 0) return
    const urls = music.tracks.map((t) => t.url)
    api.checkBulkFavorites(urls)
      .then((check) => {
        const favMap: Record<string, number | null> = {}
        for (const t of music.tracks) {
          favMap[t.url] = check[t.url] ?? null
        }
        setTrackFavorites(favMap)
      })
      .catch(() => { /* ignore */ })
  }, [expanded, music.tracks])

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === music.tracks.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(music.tracks.map((t) => t.url)))
    }
  }

  const exitSelection = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  const handleBulkQueue = () => {
    const tracks = music.tracks.filter((t) => selected.has(t.url))
    for (const track of tracks) {
      onAddToQueue(track)
    }
    toast.success(`Added ${tracks.length} tracks to Up Next`)
    exitSelection()
  }

  const handleBulkSchedule = (scheduledAt: string) => {
    const tracks = music.tracks.filter((t) => selected.has(t.url))
    onSchedule(tracks, scheduledAt)
    setBulkScheduleOpen(false)
    exitSelection()
  }

  const handleTrackFavoriteToggle = async (track: VideoMusicTrack) => {
    await toggleFavorite({
      url: track.url,
      title: track.title,
      thumbnail: track.thumbnail,
      duration: track.duration,
      currentFavoriteId: trackFavorites[track.url] ?? null,
      onOptimistic: (id) => setTrackFavorites((prev) => ({ ...prev, [track.url]: id })),
      onRollback: (id) => setTrackFavorites((prev) => ({ ...prev, [track.url]: id })),
      onSuccess: (url, favoriteId) => onFavoriteChanged(url, favoriteId),
    })
  }

  const handleTrackPlay = (track: VideoMusicTrack) => {
    onPlay(track)
  }

  const handleTrackQueue = (track: VideoMusicTrack) => {
    onAddToQueue(track)
    toast.success(`Added to Up Next: ${track.title}`)
  }

  const totalDuration = music.tracks
    .filter((t) => selected.has(t.url))
    .reduce((sum, t) => sum + t.duration, 0)

  return (
    <div className="pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-sm font-medium hover:text-primary"
          onClick={() => setExpanded(!expanded)}
        >
          <Music className="h-4 w-4" />
          Music in this video ({music.count})
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {expanded && !selecting && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelecting(true)}
          >
            Select
          </Button>
        )}
        {expanded && selecting && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={toggleAll}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={exitSelection}
            >
              <X className="h-3 w-3 mr-0.5" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-1.5 flex flex-col">
          {music.tracks.map((track) => (
            <MusicTrackItem
              key={track.url}
              track={track}
              selecting={selecting}
              selected={selected.has(track.url)}
              onToggleSelect={() => toggleSelect(track.url)}
              onPlay={() => handleTrackPlay(track)}
              onAddToQueue={() => handleTrackQueue(track)}
              onFavoriteToggle={() => handleTrackFavoriteToggle(track)}
              onOpenDetail={() => onOpenTrackDetail(track)}
              favoriteId={trackFavorites[track.url] ?? null}
            />
          ))}

          {/* Bulk actions */}
          {selecting && selected.size > 0 && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-border mt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleBulkQueue}
              >
                <ListPlus className="h-3.5 w-3.5 mr-1" />
                Add to Queue ({selected.size})
              </Button>
              <Popover open={bulkScheduleOpen} onOpenChange={setBulkScheduleOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Schedule ({selected.size})
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-auto p-3">
                  <ScheduleTimePicker
                    songCount={selected.size}
                    totalDuration={totalDuration}
                    onSchedule={handleBulkSchedule}
                    onCancel={() => setBulkScheduleOpen(false)}
                    timezone={timezone}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
