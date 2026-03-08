'use client'

import Image from 'next/image'
import { Clock, Trash2, MoreVertical, Pencil, X, Music } from 'lucide-react'
import { StatusPill } from '@/components/StatusPill'
import { ClickableThumbnail } from '@/components/ClickableThumbnail'
import { ClickableTitle } from '@/components/ClickableTitle'
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
import { EmptyState } from '@/components/EmptyState'
import { formatDatetime, formatDuration, toMediaItem } from '@/lib/utils'
import { useSchedulePanel } from '@/hooks/useSchedulePanel'

const STATUS_CONFIG: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'muted' | 'destructive' }> = {
  pending: { label: 'pending', variant: 'primary' },
  playing: { label: 'playing', variant: 'success' },
  paused: { label: 'paused', variant: 'warning' },
  completed: { label: 'completed', variant: 'muted' },
  failed: { label: 'failed', variant: 'destructive' },
}

interface SchedulePanelProps {
  onOpenDetail: (item: { url: string; title: string; thumbnail: string; duration: number }) => void
}

export function SchedulePanel({ onOpenDetail }: SchedulePanelProps) {
  const {
    schedules, isLoading, editingScheduleId, timezone,
    setEditingScheduleId, handleDelete, handleDeleteAll, handleUpdateTime,
    getEffectiveStatus, getScheduleRelTime,
  } = useSchedulePanel()

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
      <EmptyState
        icon={<Clock className="h-8 w-8 mb-2" />}
        title="No scheduled playback"
        subtitle="Use the search to schedule songs"
      />
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

      <div>
        <ul className="flex flex-col gap-2 stagger">
          {schedules.map((schedule) => {
            const effectiveStatus = getEffectiveStatus(schedule)
            const config = STATUS_CONFIG[effectiveStatus]
            const relTime = getScheduleRelTime(schedule)
            const isPending = schedule.status === 'pending'

            return (
              <li
                key={schedule.id}
                className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-sm p-3 hover:bg-card/90 transition-all overflow-hidden"
              >
                <div className="flex items-start gap-2">
                  {/* Thumbnail */}
                  {schedule.thumbnail ? (
                    schedule.url ? (
                      <ClickableThumbnail
                        onClick={() => onOpenDetail(toMediaItem(schedule))}
                        ariaLabel={`View details: ${schedule.title}`}
                      >
                        <Image src={schedule.thumbnail} alt={schedule.title || ''} width={56} height={40} className="h-10 w-14 rounded object-cover bg-muted" />
                      </ClickableThumbnail>
                    ) : (
                      <Image
                        src={schedule.thumbnail}
                        alt={schedule.title || ''}
                        width={56}
                        height={40}
                        className="h-10 w-14 rounded object-cover shrink-0 bg-muted"
                      />
                    )
                  ) : (
                    <div className="h-10 w-14 rounded bg-muted flex items-center justify-center shrink-0">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}

                  {/* Title + duration */}
                  <div className="flex-1 min-w-0">
                    {schedule.url ? (
                      <ClickableTitle onClick={() => onOpenDetail(toMediaItem(schedule))}>
                        {schedule.title || schedule.query || schedule.url}
                      </ClickableTitle>
                    ) : (
                      <p className="text-sm font-medium line-clamp-2">
                        {schedule.title || schedule.query || schedule.url}
                      </p>
                    )}
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
                  <StatusPill variant={config.variant}>{config.label}</StatusPill>
                  <div className="flex-1" />
                  {isPending ? (
                    editingScheduleId === schedule.id ? (
                      <Popover
                        open
                        onOpenChange={(open) => {
                          if (!open) setEditingScheduleId(null)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
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
                    )
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
