'use client'

import { useState } from 'react'
import { Speaker as SpeakerIcon, Play, Pause, ListMusic, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/StatusPill'
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
import { SpeakerDashboard } from '@/components/SpeakerDashboard'

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
  const [dashboardExpanded, setDashboardExpanded] = useState(false)

  if (loadingSpeakers) return null

  // No speakers state
  if (speakers.length === 0) {
    const isAdmin = user?.role === 'admin'
    return (
      <div className="border-b border-border/30 bg-card/50 backdrop-blur-sm">
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
  const showDashboardToggle = speakers.length >= 2

  return (
    <div className="border-b border-border/30 bg-card/50 backdrop-blur-sm">
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
            <StatusPill variant="success">
              <Play className="h-3 w-3 fill-current" />
              <span className="hidden sm:inline">Playing</span>
            </StatusPill>
          )}
          {isPaused && (
            <StatusPill variant="primary">
              <Pause className="h-3 w-3" />
              <span className="hidden sm:inline">Paused</span>
            </StatusPill>
          )}
          {queueCount > 0 && (
            <StatusPill variant="muted">
              <ListMusic className="h-3 w-3" />
              {queueCount} up next
            </StatusPill>
          )}
          {scheduleCount > 0 && (
            <StatusPill variant="muted">
              <Clock className="h-3 w-3" />
              {scheduleCount} scheduled
            </StatusPill>
          )}
          {isIdle && (
            <StatusPill variant="muted">Idle</StatusPill>
          )}

          {showDashboardToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-0.5"
              onClick={() => setDashboardExpanded((prev) => !prev)}
              aria-label={dashboardExpanded ? 'Collapse speaker dashboard' : 'Expand speaker dashboard'}
            >
              {dashboardExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      <SpeakerDashboard expanded={dashboardExpanded && showDashboardToggle} />
    </div>
  )
}
