'use client'

import { Speaker as SpeakerIcon, Play, Pause, ListMusic, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useStatus } from '@/contexts/StatusContext'
import { useSpeakerCounts } from '@/hooks/useSpeakerCounts'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

function StateDot({ state, online }: { state: string; online: boolean }) {
  let colorClass = 'bg-muted-foreground' // offline/unknown
  if (online) {
    if (state === 'RUNNING') {
      colorClass = 'bg-success'
    } else {
      // IDLE, SUSPENDED
      colorClass = 'bg-primary'
    }
  }
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClass}`} />
}

export function SpeakerBar() {
  const router = useRouter()
  const { user } = useAuth()
  const { speakers, activeSpeakerId, loadingSpeakers, switchSpeaker } = useSpeaker()
  const { status } = useStatus()
  const { queueCount, scheduleCount } = useSpeakerCounts(activeSpeakerId)

  if (loadingSpeakers) return null

  // No speakers state
  if (speakers.length === 0) {
    const isAdmin = user?.role === 'admin'
    return (
      <div className="border-b border-border bg-background">
        <div className="max-w-2xl mx-auto px-4 h-10 flex items-center gap-2">
          <SpeakerIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">
            {isAdmin ? 'No speakers registered.' : 'No speakers available.'}
          </span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => router.push('/admin')}
            >
              Manage
            </Button>
          )}
        </div>
      </div>
    )
  }

  const isOnActive = status.playing && status.speaker_id === activeSpeakerId
  const isPlaying = isOnActive && !status.paused
  const isPaused = isOnActive && status.paused
  const isIdle = !isPlaying && !isPaused && queueCount === 0 && scheduleCount === 0

  return (
    <div className="border-b border-border bg-background">
      <div className="max-w-2xl mx-auto px-4 h-10 flex items-center gap-2">
        <SpeakerIcon className="h-4 w-4 text-muted-foreground shrink-0" />

        <Select
          value={activeSpeakerId ? String(activeSpeakerId) : undefined}
          onValueChange={(val) => switchSpeaker(Number(val))}
        >
          <SelectTrigger className="h-7 w-auto min-w-[140px] border-0 bg-transparent text-sm px-2">
            <SelectValue placeholder="Select speaker" />
          </SelectTrigger>
          <SelectContent>
            {speakers.map((speaker) => (
              <SelectItem key={speaker.id} value={String(speaker.id)}>
                <div className="flex items-center gap-2">
                  <StateDot state={speaker.state} online={speaker.online} />
                  <span>{speaker.display_name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {isPlaying && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-success/20 text-success">
              <Play className="h-3 w-3 fill-current" />
              <span className="hidden sm:inline">Playing</span>
            </span>
          )}
          {isPaused && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-primary/20 text-primary">
              <Pause className="h-3 w-3" />
              <span className="hidden sm:inline">Paused</span>
            </span>
          )}
          {queueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
              <ListMusic className="h-3 w-3" />
              {queueCount} queued
            </span>
          )}
          {scheduleCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
              <Clock className="h-3 w-3" />
              {scheduleCount} scheduled
            </span>
          )}
          {isIdle && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
              Idle
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
