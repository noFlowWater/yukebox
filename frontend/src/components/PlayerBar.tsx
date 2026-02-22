'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, Square, Volume2, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useStatus } from '@/hooks/useStatus'
import { formatDuration, handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'

export function PlayerBar() {
  const { status } = useStatus()
  const [volumeLocal, setVolumeLocal] = useState<number | null>(null)
  const [seekLocal, setSeekLocal] = useState<number | null>(null)
  const [smoothPosition, setSmoothPosition] = useState(0)
  const sseSnapshotRef = useRef({ position: 0, time: Date.now() })

  // Sync snapshot on every SSE update
  useEffect(() => {
    sseSnapshotRef.current = { position: status.position, time: Date.now() }
    setSmoothPosition(status.position)
  }, [status.position])

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
    try {
      await api.stop()
    } catch (err) {
      handleApiError(err, 'Stop failed')
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
  if (!status.playing && !status.paused) {
    return (
      <div data-player-bar className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-center text-muted-foreground">
          <Music className="h-4 w-4 mr-2" />
          <span className="text-sm">No track playing</span>
        </div>
      </div>
    )
  }

  return (
    <div data-player-bar className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      {/* Seek bar */}
      <Slider
        value={[position]}
        max={status.duration || 1}
        step={0.1}
        onValueChange={handleSeekDrag}
        onValueCommit={handleSeekCommit}
        className="h-1 rounded-none [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:opacity-0 hover:[&_[role=slider]]:opacity-100 [&_[role=slider]]:transition-opacity"
      />

      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
        {/* Now playing info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{status.title}</p>
          <p className="text-xs text-muted-foreground">
            {status.speaker_name && <span>{status.speaker_name} &middot; </span>}
            {formatDuration(position)} / {formatDuration(status.duration)}
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

        {/* Volume */}
        <div className="flex items-center gap-2 w-20 sm:w-28 shrink-0">
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
      </div>
    </div>
  )
}
