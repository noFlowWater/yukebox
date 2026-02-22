import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert seconds to "m:ss" or "h:mm:ss" format.
 * e.g. 240 → "4:00", 3661 → "1:01:01"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00'

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Convert ISO datetime string to display format.
 * e.g. "2026-03-01T07:00:00Z" → "03/01 07:00"
 */
/**
 * Convert ISO datetime to relative time string.
 * e.g. future → "in 30m", "in 2h", "in 1d"; past/now → "now"
 */
export function getRelativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainMin = minutes % 60
  if (hours < 24) return remainMin ? `in ${hours}h ${remainMin}m` : `in ${hours}h`
  const days = Math.floor(hours / 24)
  return `in ${days}d`
}

export function formatDatetime(iso: string, timezone?: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''

  const opts: Intl.DateTimeFormatOptions = {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timezone ? { timeZone: timezone } : {}),
  }
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

/**
 * Extract year/month/day/hour/minute in a specific timezone.
 */
export function getDatePartsInTimezone(date: Date, timezone?: string): {
  year: number; month: number; day: number; hour: number; minute: number
} {
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
    ...(timezone ? { timeZone: timezone } : {}),
  }
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(date)
  const num = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)

  return {
    year: num('year'),
    month: num('month'),
    day: num('day'),
    hour: num('hour') % 24,
    minute: num('minute'),
  }
}

/**
 * Create a UTC Date from timezone-local components.
 * Uses iterative correction (2 passes) to handle DST transitions.
 */
export function createDateInTimezone(
  year: number, month: number, day: number,
  hour: number, minute: number, timezone?: string,
): Date {
  // Start with a naive UTC guess
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))

  // Iteratively correct: check what the guess looks like in the target tz
  for (let i = 0; i < 2; i++) {
    const actual = getDatePartsInTimezone(guess, timezone)
    const diffH = hour - actual.hour
    const diffM = minute - actual.minute
    // Handle day wrap (e.g., target 23:00 but got 01:00 next day)
    let totalDiffMin = diffH * 60 + diffM
    if (totalDiffMin > 720) totalDiffMin -= 1440
    if (totalDiffMin < -720) totalDiffMin += 1440
    if (totalDiffMin === 0) break
    guess = new Date(guess.getTime() + totalDiffMin * 60 * 1000)
  }

  return guess
}

export function handleApiError(err: unknown, fallback: string): void {
  toast.error(err instanceof ApiError ? err.message : fallback)
}
