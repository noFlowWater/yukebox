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

export function findDue(now: string): Schedule[] {
  return scheduleRepo.findDue(now)
}
