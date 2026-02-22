import * as scheduleRepo from '../repositories/schedule.repository.js'
import * as queueRepo from '../repositories/queue.repository.js'
import * as ytdlp from './ytdlp.service.js'
import { mpvService } from './mpv.service.js'
import { setSuppressStopCleanup, setSuppressAutoAdvance, resumePaused } from './queue.service.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import type { Schedule } from '../types/schedule.js'

let timer: ReturnType<typeof setInterval> | null = null
let suppressScheduleStop = false

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
}): Schedule {
  const speakerId = input.speaker_id ?? mpvService.getActiveSpeakerId() ?? speakerRepo.findDefault()?.id ?? null

  return scheduleRepo.insert({
    url: input.url,
    query: input.query,
    title: input.title || input.query || input.url || '',
    thumbnail: input.thumbnail,
    duration: input.duration,
    scheduled_at: input.scheduled_at,
    group_id: input.group_id,
    speaker_id: speakerId,
  })
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

// Shift pending schedules forward when a scheduled song ends early (same group only)
function advancePendingSchedules(groupId: string | null): void {
  if (!groupId) return

  const pending = scheduleRepo.findPendingByGroup(groupId)
  if (pending.length === 0) return

  const next = pending[0]
  const now = Date.now()
  const nextTime = new Date(next.scheduled_at).getTime()
  const diff = nextTime - now

  if (diff > 0) {
    for (const s of pending) {
      const shifted = new Date(new Date(s.scheduled_at).getTime() - diff)
      scheduleRepo.updateScheduledAt(s.id, shifted.toISOString())
    }
  }
}

async function pauseCurrentQueueItem(): Promise<void> {
  try {
    const status = await mpvService.getStatus()
    if (status.playing) {
      queueRepo.pausePlaying(status.position || 0)
    }
  } catch {
    // If we can't get position, pause with position 0
    queueRepo.pausePlaying(0)
  }
}

async function checkDueSchedules(): Promise<void> {
  const now = new Date().toISOString()
  const due = scheduleRepo.findDue(now)

  for (const schedule of due) {
    try {
      // Mark any currently-playing schedules as completed before starting new one
      completePlayingSchedules()

      // Pause current queue item (save playback position)
      await pauseCurrentQueueItem()

      // Resolve track
      let track
      if (schedule.url) {
        track = await ytdlp.resolve(schedule.url)
      } else {
        const results = await ytdlp.search(schedule.query, 1)
        if (results.length === 0) throw new Error('No results found')
        track = await ytdlp.resolve(results[0].url)
      }

      // Handle speaker
      const speakerId = schedule.speaker_id ?? mpvService.getActiveSpeakerId()
      if (speakerId && speakerId !== mpvService.getActiveSpeakerId()) {
        const speaker = speakerRepo.findById(speakerId)
        if (speaker) {
          suppressScheduleStop = true
          setSuppressStopCleanup(true)
          setSuppressAutoAdvance(true)
          try {
            if (mpvService.isConnected()) await mpvService.stop()
            mpvService.setActiveSpeaker(speaker.id, speaker.sink_name, speaker.display_name)
          } finally {
            suppressScheduleStop = false
            setSuppressStopCleanup(false)
          }
        }
      }

      // Play directly via mpv (not through queue)
      // suppressScheduleStop stays true during playback — reset by event handlers only
      suppressScheduleStop = true
      setSuppressStopCleanup(true)
      setSuppressAutoAdvance(true)
      try {
        await mpvService.play(track.audioUrl, track.title)
        scheduleRepo.updateStatus(schedule.id, 'playing')
      } catch {
        suppressScheduleStop = false
        throw new Error('Playback failed')
      } finally {
        setSuppressStopCleanup(false)
      }
    } catch {
      scheduleRepo.updateStatus(schedule.id, 'failed')
      suppressScheduleStop = false
    }
  }
}

export function startScheduler(): void {
  if (timer) return
  // Check every 30 seconds for due schedules
  timer = setInterval(checkDueSchedules, 30_000)

  // When a song finishes, handle schedule state
  mpvService.on('end-file', async (msg: { reason?: string }) => {
    if (msg.reason === 'eof') {
      const playingSchedules = scheduleRepo.findByStatus('playing')
      const groupId = playingSchedules.length > 0 ? playingSchedules[0].group_id : null
      completePlayingSchedules()
      suppressScheduleStop = false
      if (playingSchedules.length > 0) {
        advancePendingSchedules(groupId)
        // Check if there are more due schedules
        const moreDue = scheduleRepo.findDue(new Date().toISOString())
        if (moreDue.length > 0) {
          await checkDueSchedules()
        } else {
          // No more schedules — resume paused queue item
          setSuppressAutoAdvance(false)
          setSuppressStopCleanup(true)
          try {
            await resumePaused()
          } finally {
            setSuppressStopCleanup(false)
          }
        }
      }
    } else if (msg.reason === 'stop') {
      if (suppressScheduleStop) {
        // Stale stop event from loadfile replace — absorb it
        return
      }
      // User played something else — complete playing schedules
      const wasPlaying = scheduleRepo.findByStatus('playing').length > 0
      completePlayingSchedules()
      if (wasPlaying) {
        setSuppressAutoAdvance(false)
      }
    }
  })
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
