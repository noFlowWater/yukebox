'use client'

import { ListPlus, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker'

interface BulkActionBarProps {
  selectedCount: number
  songCount: number
  totalDuration: number
  scheduleOpen: boolean
  onScheduleOpenChange: (open: boolean) => void
  onClear: () => void
  onQueueAll: () => void
  onSchedule: (scheduledAt: string) => void
  timezone?: string
}

export function BulkActionBar({
  selectedCount,
  songCount,
  totalDuration,
  scheduleOpen,
  onScheduleOpenChange,
  onClear,
  onQueueAll,
  onSchedule,
  timezone,
}: BulkActionBarProps) {
  return (
    <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-muted/70 border border-border">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onClear}
        aria-label="Clear selection"
        title="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <span className="text-sm font-medium flex-1">
        {selectedCount} selected
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        onClick={onQueueAll}
      >
        <ListPlus className="h-3.5 w-3.5 mr-1" />
        Add All
      </Button>
      <Popover open={scheduleOpen} onOpenChange={onScheduleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7">
            <Clock className="h-3.5 w-3.5 mr-1" />
            Schedule
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          <ScheduleTimePicker
            songCount={songCount}
            totalDuration={totalDuration}
            onSchedule={onSchedule}
            onCancel={() => onScheduleOpenChange(false)}
            timezone={timezone}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
