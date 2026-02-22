'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { formatDuration, getDatePartsInTimezone, createDateInTimezone } from '@/lib/utils'

interface ScheduleTimePickerProps {
  songCount: number
  totalDuration: number
  onSchedule: (scheduledAt: string) => void
  onCancel: () => void
  timezone?: string
}

const PRESETS = [
  { label: '30m', offset: 30 * 60 * 1000 },
  { label: '1h', offset: 60 * 60 * 1000 },
  { label: '2h', offset: 2 * 60 * 60 * 1000 },
  { label: '3h', offset: 3 * 60 * 60 * 1000 },
] as const

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

function roundToNextFive(min: number): number {
  return Math.ceil(min / 5) * 5
}

export function ScheduleTimePicker({
  songCount,
  totalDuration,
  onSchedule,
  onCancel,
  timezone,
}: ScheduleTimePickerProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [isCustom, setIsCustom] = useState(false)

  const now = useMemo(() => new Date(), [])
  const defaultParts = useMemo(() => {
    const future = new Date(now.getTime() + 30 * 60 * 1000)
    const parts = getDatePartsInTimezone(future, timezone)
    const rounded = roundToNextFive(parts.minute)
    // Handle minute overflow (e.g., 58 → 60 → next hour)
    if (rounded >= 60) {
      const adjusted = createDateInTimezone(parts.year, parts.month, parts.day, parts.hour + 1, 0, timezone)
      return getDatePartsInTimezone(adjusted, timezone)
    }
    return { ...parts, minute: rounded }
  }, [now, timezone])

  const [year, setYear] = useState(defaultParts.year)
  const [month, setMonth] = useState(defaultParts.month)
  const [day, setDay] = useState(defaultParts.day)
  const [hour, setHour] = useState(defaultParts.hour)
  const [minute, setMinute] = useState(defaultParts.minute)

  const scheduledDate = useMemo(() => {
    if (isCustom) {
      return createDateInTimezone(year, month, day, hour, minute, timezone)
    }
    if (selectedPreset) {
      const preset = PRESETS.find((p) => p.label === selectedPreset)
      if (preset) return new Date(Date.now() + preset.offset)
    }
    return null
  }, [isCustom, selectedPreset, year, month, day, hour, minute])

  const isPast = scheduledDate ? scheduledDate.getTime() <= Date.now() : false

  const formatPreview = (date: Date) => {
    const opts: Intl.DateTimeFormatOptions = {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }
    const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('month')} ${get('day')}, ${get('hour')}:${get('minute')}`
  }

  const getRelativeLabel = (date: Date) => {
    const diff = date.getTime() - Date.now()
    if (diff <= 0) return 'in the past'
    const mins = Math.round(diff / 60000)
    if (mins < 60) return `in ${mins} minute${mins !== 1 ? 's' : ''}`
    const hrs = Math.floor(mins / 60)
    const remMins = mins % 60
    if (remMins === 0) return `in ${hrs} hour${hrs !== 1 ? 's' : ''}`
    return `in ${hrs}h ${remMins}m`
  }

  const handlePresetClick = (label: string) => {
    setIsCustom(false)
    setSelectedPreset(label)
  }

  const handleCustomClick = () => {
    setSelectedPreset(null)
    setIsCustom(true)
  }

  const handleSchedule = () => {
    if (!scheduledDate || isPast) return
    onSchedule(scheduledDate.toISOString())
  }

  const endTime = scheduledDate && songCount > 1
    ? new Date(scheduledDate.getTime() + totalDuration * 1000)
    : null

  return (
    <div className="flex flex-col gap-3 min-w-[260px]">
      <p className="text-sm font-medium">When to play:</p>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant={selectedPreset === p.label && !isCustom ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => handlePresetClick(p.label)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          variant={isCustom ? 'default' : 'outline'}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={handleCustomClick}
        >
          Custom
        </Button>
      </div>

      {/* Preview */}
      {scheduledDate && !isPast && (
        <div className="text-sm">
          <p>
            <span className="text-primary font-medium">{formatPreview(scheduledDate)}</span>
            {' '}
            <span className="text-muted-foreground">({getRelativeLabel(scheduledDate)})</span>
          </p>
          {endTime && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {songCount} songs · ends ~{(() => { const p = getDatePartsInTimezone(endTime, timezone); return `${padTwo(p.hour)}:${padTwo(p.minute)}`; })()}
              {' '}({formatDuration(totalDuration)})
            </p>
          )}
        </div>
      )}

      {/* Past warning */}
      {scheduledDate && isPast && (
        <p className="text-xs text-destructive">Cannot schedule in the past</p>
      )}

      {/* Custom inputs */}
      {isCustom && (
        <div className="flex items-center gap-1 text-sm">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-16 h-7 rounded border border-input bg-background px-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            min={now.getFullYear()}
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            value={padTwo(month)}
            onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value))))}
            className="w-10 h-7 rounded border border-input bg-background px-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            min={1}
            max={12}
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            value={padTwo(day)}
            onChange={(e) => setDay(Math.min(31, Math.max(1, Number(e.target.value))))}
            className="w-10 h-7 rounded border border-input bg-background px-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            min={1}
            max={31}
          />
          <span className="text-muted-foreground ml-1.5">&nbsp;</span>
          <input
            type="number"
            value={padTwo(hour)}
            onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value))))}
            className="w-10 h-7 rounded border border-input bg-background px-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            min={0}
            max={23}
          />
          <span className="text-muted-foreground">:</span>
          <input
            type="number"
            value={padTwo(minute)}
            onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value))))}
            className="w-10 h-7 rounded border border-input bg-background px-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            min={0}
            max={59}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSchedule}
          disabled={!scheduledDate || isPast}
        >
          Schedule
        </Button>
      </div>
    </div>
  )
}
