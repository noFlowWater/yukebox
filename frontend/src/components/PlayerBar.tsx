'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Play, Pause, Square, Volume2, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useStatus, EMPTY_STATUS } from '@/contexts/StatusContext'
import { formatDuration, handleApiError } from '@/lib/utils'
import type { PlaybackStatus } from '@/types'
import * as api from '@/lib/api'

export function PlayerBar() {
  const { status } = useStatus()
  const [volumeLocal, setVolumeLocal] = useState<number | null>(null)
  const [seekLocal, setSeekLocal] = useState<number | null>(null)
  const [smoothPosition, setSmoothPosition] = useState(0)
  const sseSnapshotRef = useRef({ position: 0, time: Date.now() })

  // --- Hold previous track during natural transitions ---
  const [displayStatus, setDisplayStatus] = useState<PlaybackStatus>(EMPTY_STATUS)
  const lastActiveStatusRef = useRef<PlaybackStatus | null>(null)
  const userStoppedRef = useRef(false)

  useEffect(() => {
    const isActive = status.playing || status.paused

    if (isActive) {
      userStoppedRef.current = false
      lastActiveStatusRef.current = status
      setDisplayStatus(status)
      return
    }

    // User explicitly stopped — show idle immediately
    if (userStoppedRef.current) {
      lastActiveStatusRef.current = null
      setDisplayStatus(status)
      return
    }

    // Track ended naturally — hold previous display while backend has a next track
    if (lastActiveStatusRef.current && status.has_next) {
      return
    }

    // Nothing coming — show idle
    lastActiveStatusRef.current = null
    setDisplayStatus(status)
  }, [status])

  // --- Title fade on track change ---
  const [titleOpacity, setTitleOpacity] = useState(1)
  const prevTitleRef = useRef('')

  useEffect(() => {
    if (displayStatus.title && displayStatus.title !== prevTitleRef.current && prevTitleRef.current !== '') {
      setTitleOpacity(0)
      const timer = setTimeout(() => setTitleOpacity(1), 150)
      prevTitleRef.current = displayStatus.title
      return () => clearTimeout(timer)
    }
    prevTitleRef.current = displayStatus.title
  }, [displayStatus.title])

  // --- Marquee overflow detection ---
  const titleRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [titleOverflows, setTitleOverflows] = useState(false)

  useLayoutEffect(() => {
    const measure = measureRef.current
    const container = titleRef.current
    if (!measure || !container) return
    setTitleOverflows(measure.offsetWidth > container.clientWidth)
  }, [displayStatus.title])

  // Sync snapshot on every SSE update — useLayoutEffect prevents stale position flash on track change
  useLayoutEffect(() => {
    sseSnapshotRef.current = { position: status.position, time: Date.now() }
    setSmoothPosition(status.position)
  }, [status.position, status.url])

  // Interpolate between SSE ticks at ~60fps
  useEffect(() => {
    if (!status.playing || status.paused) return

    let raf: number
    const tick = () => {
      const elapsed = (Date.now() - sseSnapshotRef.current.time) / 1000
      const interpolated = sseSnapshotRef.current.position + elapsed
      setSmoothPosition(Math.min(interpolated, status.duration))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status.playing, status.paused, status.duration])

  const volume = volumeLocal ?? status.volume
  const position = seekLocal ?? smoothPosition

  const handlePause = useCallback(async () => {
    try {
      await api.pause()
    } catch (err) {
      handleApiError(err, 'Pause failed')
    }
  }, [])

  const handleStop = useCallback(async () => {
    userStoppedRef.current = true
    try {
      await api.stop()
    } catch (err) {
      handleApiError(err, 'Stop failed')
      userStoppedRef.current = false
    }
  }, [])

  const volumeTarget = useRef<number | null>(null)

  // Clear local override once SSE catches up
  useEffect(() => {
    if (volumeTarget.current !== null && Math.round(status.volume) === volumeTarget.current) {
      volumeTarget.current = null
      setVolumeLocal(null)
    }
  }, [status.volume])

  const handleVolumeDrag = useCallback((values: number[]) => {
    setVolumeLocal(values[0])
  }, [])

  const handleVolumeCommit = useCallback(async (values: number[]) => {
    const vol = values[0]
    setVolumeLocal(vol)
    volumeTarget.current = vol
    try {
      await api.setVolume(vol)
    } catch (err) {
      handleApiError(err, 'Volume change failed')
      volumeTarget.current = null
      setVolumeLocal(null)
    }
  }, [])

  const seekTarget = useRef<number | null>(null)

  // Clear seek local once SSE position passes the target
  useEffect(() => {
    if (seekTarget.current !== null && Math.abs(status.position - seekTarget.current) < 3) {
      seekTarget.current = null
      setSeekLocal(null)
    }
  }, [status.position])

  const handleSeekDrag = useCallback((values: number[]) => {
    setSeekLocal(values[0])
  }, [])

  const handleSeekCommit = useCallback(async (values: number[]) => {
    const pos = values[0]
    setSeekLocal(pos)
    seekTarget.current = pos
    try {
      await api.seek(pos)
    } catch (err) {
      handleApiError(err, 'Seek failed')
      seekTarget.current = null
      setSeekLocal(null)
    }
  }, [])

  // Idle state
  if (!displayStatus.playing && !displayStatus.paused) {
    return (
      <div data-player-bar className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-center text-muted-foreground">
          <Music className="h-4 w-4 mr-2" />
          <span className="text-sm">No track playing</span>
        </div>
      </div>
    )
  }

  const showMarquee = displayStatus.playing && !displayStatus.paused && titleOverflows

  return (
    <div data-player-bar className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      {/* Seek bar */}
      <Slider
        value={[position]}
        max={status.duration || displayStatus.duration || 1}
        step={0.1}
        onValueChange={handleSeekDrag}
        onValueCommit={handleSeekCommit}
        className="h-1 rounded-none [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:opacity-0 hover:[&_[role=slider]]:opacity-100 [&_[role=slider]]:transition-opacity [&>span:first-child]:rounded-none"
      />

      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
        {/* Now playing info */}
        <div className="flex-1 min-w-0">
          <div
            ref={titleRef}
            className="overflow-hidden transition-opacity duration-300 relative"
            style={{ opacity: titleOpacity }}
          >
            <span
              ref={measureRef}
              className="text-sm font-medium whitespace-nowrap absolute invisible pointer-events-none"
              aria-hidden="true"
            >
              {displayStatus.title}
            </span>
            {showMarquee ? (
              <div className="animate-marquee whitespace-nowrap w-max">
                <span className="text-sm font-medium pr-8">{displayStatus.title}</span>
                <span className="text-sm font-medium pr-8" aria-hidden="true">{displayStatus.title}</span>
              </div>
            ) : (
              <p className="text-sm font-medium truncate">{displayStatus.title}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {displayStatus.speaker_name && <span>{displayStatus.speaker_name} &middot; </span>}
            {formatDuration(position)} / {formatDuration(status.duration || displayStatus.duration)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePause}
            title={status.paused ? 'Resume' : 'Pause'}
          >
            {status.paused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleStop}
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume — desktop inline */}
        <div className="hidden sm:flex items-center gap-2 w-28 shrink-0">
          <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeDrag}
            onValueCommit={handleVolumeCommit}
            className="flex-1"
          />
        </div>

        {/* Volume — mobile popover */}
        <div className="sm:hidden shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Volume">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-48 p-3">
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeDrag}
                  onValueCommit={handleVolumeCommit}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{Math.round(volume)}%</span>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
