'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Clock, Trash2, MoreVertical, Pencil, X, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'
import { formatDatetime, formatDuration, getRelativeTime, handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useStatus } from '@/contexts/StatusContext'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import type { Schedule } from '@/types'

const POLL_INTERVAL = 3000

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'pending', className: 'bg-primary/20 text-primary' },
  playing: { label: 'playing', className: 'bg-success/20 text-success' },
  paused: { label: 'paused', className: 'bg-warning/20 text-warning' },
  completed: { label: 'completed', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'failed', className: 'bg-destructive/20 text-destructive' },
}

export function SchedulePanel() {
  const { activeSpeakerId } = useSpeaker()
  const { status: playbackStatus } = useStatus()
  const { timezone } = useAccessibility()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [, setTick] = useState(0)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const editAnchorRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map())

  const fetchSchedules = useCallback(async () => {
    try {
      const items = await api.getSchedules(activeSpeakerId)
      setSchedules(items)
    } catch {
      // silent on poll errors
    } finally {
      setIsLoading(false)
    }
  }, [activeSpeakerId])

  // Initial fetch + polling + listen for external updates
  useEffect(() => {
    fetchSchedules()
    const id = setInterval(fetchSchedules, POLL_INTERVAL)
    const onUpdate = () => fetchSchedules()
    window.addEventListener('schedule-updated', onUpdate)
    return () => {
      clearInterval(id)
      window.removeEventListener('schedule-updated', onUpdate)
    }
  }, [fetchSchedules])

  // Refresh relative times every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleDelete = useCallback(async (id: number) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
    try {
      await api.deleteSchedule(id)
    } catch (err) {
      handleApiError(err, 'Failed to delete schedule')
      fetchSchedules()
    }
  }, [fetchSchedules])

  const handleDeleteAll = useCallback(async () => {
    const prev = schedules
    setSchedules([])
    try {
      await api.deleteAllSchedules(activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Failed to clear schedules')
      setSchedules(prev)
    }
  }, [schedules, activeSpeakerId])

  const handleUpdateTime = useCallback(async (id: number, scheduledAt: string) => {
    try {
      const updated = await api.updateScheduleTime(id, scheduledAt)
      setSchedules((prev) => {
        const updatedIds = new Set(updated.map((u) => u.id))
        return prev.map((s) => {
          const match = updated.find((u) => u.id === s.id)
          return match ?? s
        }).filter((s) => updatedIds.has(s.id) || !updated.some((u) => u.id === s.id))
      })
      setEditingScheduleId(null)
      window.dispatchEvent(new Event('schedule-updated'))
    } catch (err) {
      handleApiError(err, 'Failed to update schedule time')
      fetchSchedules()
    }
  }, [fetchSchedules])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2" />
        <p className="text-sm">No scheduled playback</p>
        <p className="text-xs mt-1">Use the search to schedule songs</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      {/* Header with clear all */}
      <div className="flex items-center justify-end py-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={handleDeleteAll}
          title="Clear all schedules"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Clear all
        </Button>
      </div>

      <div className="max-h-[50vh] overflow-y-auto">
        <ul className="flex flex-col gap-2">
          {schedules.map((schedule) => {
            // Derive effective status from SSE playback state
            let effectiveStatus: string = schedule.status
            if (schedule.status === 'playing') {
              if (!playbackStatus.playing && !playbackStatus.paused) {
                effectiveStatus = 'completed'
              } else if (playbackStatus.paused) {
                effectiveStatus = 'paused'
              }
            }
            const config = STATUS_CONFIG[effectiveStatus]
            const relTime = schedule.status === 'pending'
              ? getRelativeTime(schedule.scheduled_at)
              : null
            const isPending = schedule.status === 'pending'

            return (
              <li
                key={schedule.id}
                className="rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors overflow-hidden"
              >
                <div className="flex items-start gap-2">
                  {/* Thumbnail */}
                  {schedule.thumbnail ? (
                    <Image
                      src={schedule.thumbnail}
                      alt={schedule.title || ''}
                      width={56}
                      height={40}
                      className="h-10 w-14 rounded object-cover shrink-0 bg-muted pointer-events-none"
                    />
                  ) : (
                    <div className="h-10 w-14 rounded bg-muted flex items-center justify-center shrink-0">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}

                  {/* Title + duration */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {schedule.title || schedule.query || schedule.url}
                    </p>
                    <div className="flex items-center gap-2">
                      {schedule.duration > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(schedule.duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {relTime && (
                    <span className="text-xs text-primary font-medium shrink-0">
                      {relTime}
                    </span>
                  )}
                </div>

                {/* Row 2: datetime + status badge + actions */}
                <div className="flex items-center gap-2 mt-1.5 ml-16">
                  <span className="text-xs text-muted-foreground">
                    {formatDatetime(schedule.scheduled_at, timezone)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.className}`}>
                    {config.label}
                  </span>
                  <div className="flex-1" />
                  {isPending ? (
                    <Popover
                      open={editingScheduleId === schedule.id}
                      onOpenChange={(open) => {
                        if (!open) setEditingScheduleId(null)
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          ref={(el) => { editAnchorRefs.current.set(schedule.id, el) }}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 data-[state=open]:hidden"
                          style={{ display: editingScheduleId === schedule.id ? 'none' : undefined }}
                          tabIndex={-1}
                        >
                          <span className="sr-only">Edit time anchor</span>
                        </Button>
                      </PopoverTrigger>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            title="Schedule options"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => setEditingScheduleId(schedule.id)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit time
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(schedule.id)}
                          >
                            <X className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <PopoverContent align="end" className="w-auto p-3">
                        <ScheduleTimePicker
                          songCount={1}
                          totalDuration={schedule.duration}
                          initialTime={schedule.scheduled_at}
                          submitLabel="Update"
                          timezone={timezone}
                          onSchedule={(scheduledAt) => handleUpdateTime(schedule.id, scheduledAt)}
                          onCancel={() => setEditingScheduleId(null)}
                        />
                        {schedule.group_id && (
                          <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                            All pending items in this group will shift together.
                          </p>
                        )}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleDelete(schedule.id)}
                      title="Delete schedule"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
