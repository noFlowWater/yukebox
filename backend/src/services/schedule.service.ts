import * as scheduleRepo from '../repositories/schedule.repository.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import type { Schedule } from '../types/schedule.js'

export function getAll(speakerId?: number): Schedule[] {
  return scheduleRepo.findAll(speakerId)
}

export function getById(id: number): Schedule | undefined {
  return scheduleRepo.findById(id)
}

export function create(input: {
  url?: string
  query?: string
  title?: string
  thumbnail?: string
  duration?: number
  speaker_id?: number
  group_id?: string
  scheduled_at: string
}): { schedule: Schedule; warning?: string } {
  const speakerId = input.speaker_id ?? speakerRepo.findDefault()?.id ?? null

  // Check for overlap warning
  let warning: string | undefined
  if (speakerId) {
    const existing = scheduleRepo.findAll(speakerId)
    const newTime = new Date(input.scheduled_at).getTime()
    const newDuration = (input.duration ?? 180) * 1000

    for (const s of existing) {
      if (s.status !== 'pending') continue
      const existingTime = new Date(s.scheduled_at).getTime()
      const existingDuration = (s.duration ?? 180) * 1000

      // Check if times overlap
      if (newTime < existingTime + existingDuration && newTime + newDuration > existingTime) {
        const timeStr = new Date(s.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        warning = `Overlaps with existing schedule '${s.title}' (${timeStr})`
        break
      }
    }

    // Block exact same-time schedules
    const sameTime = existing.find(
      (s) => s.status === 'pending' && new Date(s.scheduled_at).getTime() === newTime
    )
    if (sameTime) {
      throw new Error(`A schedule already exists at this exact time for this speaker`)
    }
  }

  const schedule = scheduleRepo.insert({
    url: input.url,
    query: input.query,
    title: input.title || input.query || input.url || '',
    thumbnail: input.thumbnail,
    duration: input.duration,
    scheduled_at: input.scheduled_at,
    group_id: input.group_id,
    speaker_id: speakerId,
  })

  return { schedule, warning }
}

export function remove(id: number): boolean {
  return scheduleRepo.remove(id)
}

export function removeAll(speakerId?: number): number {
  return scheduleRepo.removeAll(speakerId)
}

export function completePlayingSchedules(): void {
  const playing = scheduleRepo.findByStatus('playing')
  for (const s of playing) {
    scheduleRepo.updateStatus(s.id, 'completed')
  }
}

export function findPendingByGroup(groupId: string): Schedule[] {
  return scheduleRepo.findPendingByGroup(groupId)
}

export function updateStatus(id: number, status: string): boolean {
  return scheduleRepo.updateStatus(id, status)
}

export function updateScheduledTime(
  id: number,
  newScheduledAt: string,
): { updated: Schedule[]; warning?: string } {
  const schedule = scheduleRepo.findById(id)
  if (!schedule) {
    const err = new Error('Schedule not found') as Error & { statusCode: number; code: string }
    err.statusCode = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (schedule.status !== 'pending') {
    const err = new Error('Only pending schedules can be updated') as Error & { statusCode: number; code: string }
    err.statusCode = 400
    err.code = 'INVALID_STATUS'
    throw err
  }

  const newTime = new Date(newScheduledAt).getTime()
  if (newTime <= Date.now()) {
    const err = new Error('Cannot schedule in the past') as Error & { statusCode: number; code: string }
    err.statusCode = 400
    err.code = 'PAST_TIME'
    throw err
  }

  const oldTime = new Date(schedule.scheduled_at).getTime()
  const delta = newTime - oldTime

  let updatedSchedules: Schedule[]

  if (schedule.group_id) {
    const groupItems = scheduleRepo.findPendingByGroup(schedule.group_id)

    // Check if any item would move to the past
    for (const item of groupItems) {
      const shifted = new Date(item.scheduled_at).getTime() + delta
      if (shifted <= Date.now()) {
        const err = new Error('Some items in the group would be scheduled in the past') as Error & { statusCode: number; code: string }
        err.statusCode = 400
        err.code = 'PAST_TIME'
        throw err
      }
    }

    // Apply delta to all group items
    for (const item of groupItems) {
      const shifted = new Date(new Date(item.scheduled_at).getTime() + delta).toISOString()
      scheduleRepo.updateScheduledAt(item.id, shifted)
    }

    updatedSchedules = groupItems.map((item) => ({
      ...item,
      scheduled_at: new Date(new Date(item.scheduled_at).getTime() + delta).toISOString(),
    }))
  } else {
    const normalizedTime = new Date(newScheduledAt).toISOString()
    scheduleRepo.updateScheduledAt(id, normalizedTime)
    updatedSchedules = [{ ...schedule, scheduled_at: normalizedTime }]
  }

  // Check for overlap warning
  let warning: string | undefined
  const speakerId = schedule.speaker_id
  if (speakerId) {
    const existing = scheduleRepo.findAll(speakerId)
    const updatedIds = new Set(updatedSchedules.map((s) => s.id))

    for (const updated of updatedSchedules) {
      const uTime = new Date(updated.scheduled_at).getTime()
      const uDuration = (updated.duration ?? 180) * 1000

      for (const s of existing) {
        if (s.status !== 'pending' || updatedIds.has(s.id)) continue
        const existingTime = new Date(s.scheduled_at).getTime()
        const existingDuration = (s.duration ?? 180) * 1000

        if (uTime < existingTime + existingDuration && uTime + uDuration > existingTime) {
          const timeStr = new Date(s.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          warning = `Overlaps with existing schedule '${s.title}' (${timeStr})`
          break
        }
      }
      if (warning) break
    }
  }

  return { updated: updatedSchedules, warning }
}

export function findDue(now: string): Schedule[] {
  return scheduleRepo.findDue(now)
}
