'use client'

import { Play, Pause, Square, Volume2, Music, Search } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { formatDuration, getYoutubeThumbnail } from '@/lib/utils'
import { usePlayerBar } from '@/hooks/usePlayerBar'
import { useSpeaker } from '@/contexts/SpeakerContext'

interface PlayerBarProps {
  onSearchClick?: () => void
}

function EqBars() {
  return (
    <div className="flex items-end gap-[3px] h-5 justify-center">
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
    </div>
  )
}

export function PlayerBar({ onSearchClick }: PlayerBarProps) {
  const {
    status, displayStatus, volume, position,
    titleOpacity, isIdle, showMarquee,
    titleRef, measureRef,
    handlePause, handleStop,
    handleVolumeDrag, handleVolumeCommit,
    handleSeekDrag, handleSeekCommit,
  } = usePlayerBar()

  const { speakers, activeSpeakerId } = useSpeaker()
  const activeSpeaker = speakers.find((s) => s.id === activeSpeakerId)

  const thumbnail = getYoutubeThumbnail(displayStatus.url)
  const duration = status.duration || displayStatus.duration || 0

  // ── Idle state ──
  if (isIdle) {
    return (
      <div data-player-bar className="h-full flex flex-col items-center justify-center px-6">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-full bg-card border-2 border-border flex items-center justify-center">
            <Music className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="absolute inset-[-12px] rounded-full border border-dashed border-border/40 animate-spin-slow" />
        </div>

        <p className="text-muted-foreground text-sm font-light mb-4">
          No track playing
        </p>

        {onSearchClick && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-5 gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={onSearchClick}
          >
            <Search className="h-4 w-4" />
            Search music
          </Button>
        )}
      </div>
    )
  }

  // ── Playing state ──
  // Album art sized by viewport: 100dvh minus header(3rem) speaker(2.5rem) peek(9.25rem) fixed-ui(11rem) breathing(2.25rem) = 100dvh - 28rem
  // Uses dvh (dynamic viewport height) for iOS browser chrome compatibility
  return (
    <div data-player-bar className="relative w-full animate-fade-in">
      {/* Blurred album art background */}
      {thumbnail && (
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={thumbnail}
            alt=""
            fill
            className="object-cover blur-3xl scale-110 opacity-20"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center max-w-sm mx-auto px-6">
        {/* Album art — viewport-relative size */}
        <div
          className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/40 bg-card mb-3"
          style={{ width: 'min(80vw, calc(100dvh - 28rem))' }}
        >
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={displayStatus.title || ''}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}

          {!status.paused && (
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <EqBars />
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="w-full text-center mb-2">
          <div
            ref={titleRef}
            className="overflow-hidden transition-opacity duration-300"
            style={{ opacity: titleOpacity }}
          >
            <span
              ref={measureRef}
              className="text-base font-display font-semibold whitespace-nowrap absolute invisible pointer-events-none"
              aria-hidden="true"
            >
              {displayStatus.title}
            </span>
            {showMarquee ? (
              <div className="animate-marquee whitespace-nowrap w-max mx-auto">
                <span className="text-base font-display font-semibold pr-12">{displayStatus.title}</span>
                <span className="text-base font-display font-semibold pr-12" aria-hidden="true">{displayStatus.title}</span>
              </div>
            ) : (
              <p className="text-base font-display font-semibold truncate">{displayStatus.title}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-light">
            {activeSpeaker?.display_name || displayStatus.speaker_name || 'Unknown speaker'}
          </p>
        </div>

        {/* Seek bar */}
        <div className="w-full mb-2">
          <Slider
            value={[position]}
            max={duration || 1}
            step={0.1}
            onValueChange={handleSeekDrag}
            onValueCommit={handleSeekCommit}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-muted-foreground font-light tabular-nums">
              {formatDuration(position)}
            </span>
            <span className="text-[11px] text-muted-foreground font-light tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                title="Volume"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-48 p-3 rounded-xl">
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
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0 tabular-nums">
                  {Math.round(volume)}%
                </span>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="icon"
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
            onClick={handlePause}
            title={status.paused ? 'Resume' : 'Pause'}
          >
            {status.paused ? (
              <Play className="h-5 w-5 ml-0.5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            onClick={handleStop}
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
