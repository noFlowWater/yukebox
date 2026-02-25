'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, ListMusic, WifiOff } from 'lucide-react'
import { useSpeaker } from '@/contexts/SpeakerContext'
import * as api from '@/lib/api'
import type { SpeakerStatus } from '@/types'

const POLL_INTERVAL = 3000

function StateDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${online ? 'bg-success' : 'bg-muted-foreground'}`}
    />
  )
}

interface SpeakerDashboardProps {
  expanded: boolean
}

export function SpeakerDashboard({ expanded }: SpeakerDashboardProps) {
  const { speakers, activeSpeakerId, switchSpeaker } = useSpeaker()
  const [statuses, setStatuses] = useState<SpeakerStatus[]>([])

  const fetchStatuses = useCallback(async () => {
    try {
      const data = await api.getStatusAll()
      setStatuses(data)
    } catch {
      // silent on poll errors
    }
  }, [])

  useEffect(() => {
    if (!expanded) return

    fetchStatuses()
    const id = setInterval(fetchStatuses, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [expanded, fetchStatuses])

  if (!expanded) return null

  // Build a map of speaker_id → status for quick lookup
  const statusMap = new Map(statuses.map((s) => [s.speaker_id, s]))

  return (
    <div className="flex flex-col gap-1.5 px-4 pb-3 pt-1.5 max-w-2xl mx-auto">
      {speakers.map((speaker) => {
        const status = statusMap.get(speaker.id)
        const isActive = speaker.id === activeSpeakerId
        const isPlaying = status?.playing && !status?.paused
        const isPaused = status?.paused
        const isOffline = !speaker.online

        return (
          <button
            key={speaker.id}
            type="button"
            onClick={() => switchSpeaker(speaker.id)}
            className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
              isActive
                ? 'bg-primary/10 border border-primary/30'
                : 'bg-muted/50 border border-transparent hover:bg-muted'
            } ${isOffline ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <StateDot online={speaker.online} />
              <span className="text-sm font-medium truncate shrink-0 max-w-[140px]">
                {speaker.display_name}
              </span>

              {/* Status badge */}
              {isPlaying && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-success/20 text-success shrink-0">
                  <Play className="h-2.5 w-2.5 fill-current" />
                  Playing
                </span>
              )}
              {isPaused && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-primary/20 text-primary shrink-0">
                  <Pause className="h-2.5 w-2.5" />
                  Paused
                </span>
              )}
              {isOffline && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground shrink-0">
                  <WifiOff className="h-2.5 w-2.5" />
                  Offline
                </span>
              )}
              {!isPlaying && !isPaused && !isOffline && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground shrink-0">
                  Idle
                </span>
              )}

              {/* Spacer */}
              <span className="flex-1" />

              {/* Right side: volume + queue count */}
              {!isOffline && status && (
                <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5 text-[10px]">
                    <Volume2 className="h-3 w-3" />
                    {status.volume}
                  </span>
                  {status.queue_count > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px]">
                      <ListMusic className="h-3 w-3" />
                      {status.queue_count}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Track title — second row */}
            {(isPlaying || isPaused) && status?.title && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 ml-4">
                {status.title}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
