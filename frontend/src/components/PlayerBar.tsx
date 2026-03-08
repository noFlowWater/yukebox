'use client'

import { Play, Pause, Square, Volume2, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { formatDuration } from '@/lib/utils'
import { usePlayerBar } from '@/hooks/usePlayerBar'

export function PlayerBar() {
  const {
    status, displayStatus, volume, position,
    titleOpacity, isIdle, showMarquee,
    titleRef, measureRef,
    handlePause, handleStop,
    handleVolumeDrag, handleVolumeCommit,
    handleSeekDrag, handleSeekCommit,
  } = usePlayerBar()

  // Idle state
  if (isIdle) {
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
