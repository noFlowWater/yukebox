import { PlaybackEngine } from './playback-engine.js'
import * as scheduleRepo from '../repositories/schedule.repository.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import type { MpvStatus } from '../types/mpv.js'

class PlaybackManager {
  private engines = new Map<number, PlaybackEngine>()
  private scheduleTimer: ReturnType<typeof setInterval> | null = null

  async init(): Promise<void> {
    // Create engines for all registered speakers
    const speakers = speakerRepo.findAll()
    for (const speaker of speakers) {
      try {
        this.getOrCreateEngine(speaker.id)
      } catch {
        // Speaker init failed — continue with others
      }
    }

    // Start schedule timer
    this.startScheduleTimer()
  }

  getEngine(speakerId: number): PlaybackEngine | null {
    return this.engines.get(speakerId) ?? null
  }

  getOrCreateEngine(speakerId: number): PlaybackEngine {
    let engine = this.engines.get(speakerId)
    if (!engine) {
      engine = new PlaybackEngine(speakerId)
      this.engines.set(speakerId, engine)
    }
    return engine
  }

  getDefaultEngine(): PlaybackEngine | null {
    const defaultSpeaker = speakerRepo.findDefault()
    if (!defaultSpeaker) return null

    return this.getEngine(defaultSpeaker.id)
  }

  async destroyEngine(speakerId: number): Promise<void> {
    const engine = this.engines.get(speakerId)
    if (engine) {
      await engine.destroy()
      this.engines.delete(speakerId)
    }
  }

  async destroyAll(): Promise<void> {
    const destroyPromises: Promise<void>[] = []
    for (const [, engine] of this.engines) {
      destroyPromises.push(engine.destroy())
    }
    await Promise.allSettled(destroyPromises)
    this.engines.clear()
  }

  // --- Schedule timer ---

  startScheduleTimer(): void {
    if (this.scheduleTimer) return
    // Check every 10 seconds for due schedules
    this.scheduleTimer = setInterval(() => this.checkDueSchedules(), 10_000)
  }

  stopScheduleTimer(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer)
      this.scheduleTimer = null
    }
  }

  private async checkDueSchedules(): Promise<void> {
    try {
      const now = new Date()
      const nowIso = now.toISOString()
      const due = scheduleRepo.findDue(nowIso)

      for (const schedule of due) {
        try {
          // Check if past schedule (due > 60s ago) → mark failed
          const dueTime = new Date(schedule.scheduled_at).getTime()
          const diff = now.getTime() - dueTime

          if (diff > 60_000) {
            scheduleRepo.updateStatus(schedule.id, 'failed')
            continue
          }

          // Find the correct engine for this schedule's speaker
          const speakerId = schedule.speaker_id
          if (!speakerId) {
            scheduleRepo.updateStatus(schedule.id, 'failed')
            continue
          }

          const engine = this.getEngine(speakerId)
          if (!engine) {
            scheduleRepo.updateStatus(schedule.id, 'failed')
            continue
          }

          await engine.triggerSchedule({
            id: schedule.id,
            url: schedule.url,
            query: schedule.query,
            title: schedule.title,
            thumbnail: schedule.thumbnail,
            duration: schedule.duration,
            group_id: schedule.group_id,
          })
        } catch {
          scheduleRepo.updateStatus(schedule.id, 'failed')
        }
      }
    } catch {
      // Prevent timer crashes
    }
  }

  // --- Status ---

  getStatus(speakerId: number): MpvStatus | null {
    const engine = this.getEngine(speakerId)
    if (!engine) return null
    return engine.getStatus()
  }

  async getAllStatusesAsync(): Promise<MpvStatus[]> {
    const speakers = speakerRepo.findAll()
    const promises = speakers.map(async (speaker) => {
      const engine = this.getEngine(speaker.id)
      if (!engine) {
        return {
          playing: false,
          paused: false,
          title: '',
          url: '',
          duration: 0,
          position: 0,
          volume: 60,
          speaker_id: speaker.id,
          speaker_name: speaker.display_name,
          has_next: false,
        } satisfies MpvStatus
      }
      return engine.getStatusAsync()
    })
    return Promise.all(promises)
  }
}

export const playbackManager = new PlaybackManager()
