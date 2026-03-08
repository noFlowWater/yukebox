import { EventEmitter } from 'node:events'
import { MpvProcess } from './mpv-process.js'
import { QueueManager } from './queue-manager.js'
import * as ytdlp from './ytdlp.service.js'
import * as scheduleRepo from '../repositories/schedule.repository.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import * as settingsService from './settings.service.js'
import type { QueueItem } from '../types/queue.js'
import type { MpvStatus, PlaybackState } from '../types/mpv.js'
import type { PlaybackMode } from '../types/speaker.js'

export interface PlayResult {
  title: string
  url: string
  thumbnail: string
  duration: number
}

export class PlaybackEngine extends EventEmitter {
  readonly speakerId: number
  private mpv: MpvProcess
  private queue: QueueManager
  private state: PlaybackState = 'idle'
  private mutex = false
  private pendingCommands: Array<() => void> = []
  private speakerName: string
  private defaultVolume: number
  private emitTimer: ReturnType<typeof setTimeout> | null = null
  private positionHeartbeat: ReturnType<typeof setInterval> | null = null

  constructor(speakerId: number) {
    super()
    this.setMaxListeners(50)
    this.speakerId = speakerId

    const speaker = speakerRepo.findById(speakerId)
    if (!speaker) throw new Error(`Speaker ${speakerId} not found`)

    this.speakerName = speaker.display_name
    this.defaultVolume = speaker.default_volume ?? settingsService.getDefaultVolume()

    this.mpv = new MpvProcess(speakerId, speaker.sink_name)
    this.queue = QueueManager.load(speakerId)

    this.mpv.on('track-end', () => this.handleTrackEnd())
    this.mpv.on('track-error', () => this.handleTrackError())
    this.mpv.on('process-exit', () => this.handleProcessExit())
    this.mpv.on('property-change', (name: string, _value: unknown) => this.handlePropertyChange(name))
  }

  // --- Playback actions ---

  async playNow(input: {
    url?: string
    query?: string
    title?: string
    thumbnail?: string
    duration?: number
  }): Promise<PlayResult> {
    return await this.withMutex(async () => {
      // Resolve track info if needed
      let url: string
      let title: string
      let thumbnail: string
      let duration: number

      if (input.url && input.title) {
        url = input.url
        title = input.title
        thumbnail = input.thumbnail ?? ''
        duration = input.duration ?? 0
      } else if (input.url) {
        const track = await ytdlp.resolve(input.url)
        url = track.url
        title = track.title
        thumbnail = track.thumbnail
        duration = track.duration
      } else if (input.query) {
        const results = await ytdlp.search(input.query, 1)
        if (results.length === 0) throw new Error('No results found')
        const track = await ytdlp.resolve(results[0].url)
        url = track.url
        title = track.title
        thumbnail = track.thumbnail
        duration = track.duration
      } else {
        throw new Error('Either url or query is required')
      }

      // If currently playing, pause current item (save position) — stays in queue as 'paused'
      if (this.state === 'playing' || this.state === 'paused') {
        await this.pauseCurrentItem()
      }

      // Insert new item at front of queue (paused item remains behind it)
      const queueItem = this.queue.insertAtFront({
        url,
        title,
        thumbnail,
        duration,
      })
      this.queue.markPlaying(queueItem.id)

      // Play it
      await this.startPlayback(url, title)

      return { title, url, thumbnail, duration }
    })
  }

  async stop(): Promise<void> {
    return await this.withMutex(async () => {
      if (this.state === 'idle') return

      try {
        await this.mpv.stopPlayback()
      } catch {
        // mpv may already be stopped
      }

      // Remove the current playing item
      this.queue.removePlaying()
      this.state = 'idle'
      this.stopPositionHeartbeat()
      this.scheduleStatusEmit()
    })
  }

  async togglePause(): Promise<void> {
    if (this.state === 'playing') {
      await this.mpv.pause()
      this.state = 'paused'
      this.stopPositionHeartbeat()
      this.scheduleStatusEmit()
    } else if (this.state === 'paused') {
      await this.mpv.resume()
      this.state = 'playing'
      this.startPositionHeartbeat()
      this.scheduleStatusEmit()
    }
  }

  async setVolume(volume: number): Promise<void> {
    this.defaultVolume = volume
    await this.mpv.setVolume(volume)
    this.scheduleStatusEmit()
  }

  async seek(position: number): Promise<void> {
    await this.mpv.seekTo(position)
  }

  getStatus(): MpvStatus {
    const front = this.queue.front()
    const isPlaying = this.state === 'playing' || this.state === 'loading'
    const isPaused = this.state === 'paused'

    // Check for next playable item
    const allItems = this.queue.getAll()
    const hasNext = allItems.some((item) =>
      item.status === 'pending' || item.status === 'paused'
    )

    // Enrich with cached MPV data when connected
    const cached = this.mpv.getCachedPlaybackInfo()

    return {
      playing: isPlaying,
      paused: isPaused,
      title: (isPlaying || isPaused) && front ? front.title : '',
      url: (isPlaying || isPaused) && front ? front.url : '',
      duration: (isPlaying || isPaused) && front ? (cached.duration || front.duration) : 0,
      position: (isPlaying || isPaused) ? cached.position : 0,
      volume: cached.volume ?? this.defaultVolume,
      speaker_id: this.speakerId,
      speaker_name: this.speakerName,
      has_next: hasNext,
    }
  }

  async getStatusAsync(): Promise<MpvStatus> {
    return this.getStatus()
  }

  // --- Queue actions ---

  async addToQueue(input: {
    url?: string
    query?: string
    title?: string
    thumbnail?: string
    duration?: number
  }): Promise<QueueItem> {
    let url: string
    let title: string
    let thumbnail: string
    let duration: number

    if (input.url && input.title) {
      url = input.url
      title = input.title
      thumbnail = input.thumbnail ?? ''
      duration = input.duration ?? 0
    } else if (input.url) {
      const track = await ytdlp.resolve(input.url)
      url = track.url
      title = track.title
      thumbnail = track.thumbnail
      duration = track.duration
    } else if (input.query) {
      const results = await ytdlp.search(input.query, 1)
      if (results.length === 0) throw new Error('No results found')
      const track = await ytdlp.resolve(results[0].url)
      url = track.url
      title = track.title
      thumbnail = track.thumbnail
      duration = track.duration
    } else {
      throw new Error('Either url or query is required')
    }

    const item = this.queue.append({ url, title, thumbnail, duration })
    this.scheduleStatusEmit()
    return item
  }

  async addToQueueBulk(
    items: { url: string; title?: string; thumbnail?: string; duration?: number }[],
  ): Promise<QueueItem[]> {
    const resolved: { url: string; title: string; thumbnail: string; duration: number }[] = []

    for (const item of items) {
      try {
        if (item.title) {
          resolved.push({
            url: item.url,
            title: item.title,
            thumbnail: item.thumbnail ?? '',
            duration: item.duration ?? 0,
          })
        } else {
          const track = await ytdlp.resolve(item.url)
          resolved.push({
            url: item.url,
            title: track.title,
            thumbnail: track.thumbnail,
            duration: track.duration,
          })
        }
      } catch {
        // Skip failed items
      }
    }

    const added = this.queue.appendBulk(resolved)
    this.scheduleStatusEmit()
    return added
  }

  removeFromQueue(id: number): boolean {
    const result = this.queue.remove(id)
    this.scheduleStatusEmit()
    return result
  }

  reorderQueue(id: number, newPos: number): boolean {
    const result = this.queue.reorder(id, newPos)
    this.scheduleStatusEmit()
    return result
  }

  shuffleQueue(): void {
    this.queue.shuffle()
    this.scheduleStatusEmit()
  }

  clearQueue(): number {
    const count = this.queue.clearPending()
    this.scheduleStatusEmit()
    return count
  }

  async playFromQueue(id: number): Promise<QueueItem | null> {
    return await this.withMutex(async () => {
      const items = this.queue.getAll()
      const item = items.find((i) => i.id === id)
      if (!item) return null

      // If currently playing, pause current item — stays in queue as 'paused'
      if (this.state === 'playing' || this.state === 'paused') {
        await this.pauseCurrentItem()
      }

      // Move target to front (paused item remains behind it)
      const moved = this.queue.moveToFront(id)
      if (!moved) return null

      this.queue.markPlaying(moved.id)

      // Resolve and play
      try {
        const track = await ytdlp.resolve(moved.url)
        await this.startPlayback(track.audioUrl, moved.title)
      } catch {
        this.queue.remove(moved.id)
        return null
      }

      return moved
    })
  }

  // --- Schedule trigger ---

  async triggerSchedule(schedule: {
    id: number
    url: string
    query: string
    title: string
    thumbnail: string
    duration: number
    group_id: string | null
  }): Promise<void> {
    return await this.withMutex(async () => {
      // Mark any currently-playing schedules as completed
      const playingSchedules = scheduleRepo.findByStatus('playing')
      for (const s of playingSchedules) {
        if (s.speaker_id === this.speakerId) {
          scheduleRepo.updateStatus(s.id, 'completed')
        }
      }

      // If currently playing, pause current item
      if (this.state === 'playing' || this.state === 'paused') {
        await this.pauseCurrentItem()
      }

      // Insert schedule item at front of queue
      this.queue.removePlaying()
      const queueItem = this.queue.insertAtFront({
        url: schedule.url,
        title: schedule.title,
        thumbnail: schedule.thumbnail,
        duration: schedule.duration,
        schedule_id: schedule.id,
      })
      this.queue.markPlaying(queueItem.id)

      // Resolve and play
      try {
        let track
        if (schedule.url) {
          track = await ytdlp.resolve(schedule.url)
        } else {
          const results = await ytdlp.search(schedule.query, 1)
          if (results.length === 0) throw new Error('No results found')
          track = await ytdlp.resolve(results[0].url)
        }

        await this.startPlayback(track.audioUrl, schedule.title)
        scheduleRepo.updateStatus(schedule.id, 'playing')
      } catch {
        this.queue.remove(queueItem.id)
        scheduleRepo.updateStatus(schedule.id, 'failed')
      }
    })
  }

  async triggerGroupContinuation(groupId: string): Promise<boolean> {
    const pending = scheduleRepo.findPendingByGroup(groupId)
    if (pending.length === 0) return false

    const next = pending[0]
    if (next.speaker_id !== this.speakerId) return false

    await this.triggerSchedule({
      id: next.id,
      url: next.url,
      query: next.query,
      title: next.title,
      thumbnail: next.thumbnail,
      duration: next.duration,
      group_id: next.group_id,
    })
    return true
  }

  // --- Internal ---

  private async startPlayback(audioUrl: string, title: string, startPosition?: number): Promise<void> {
    this.state = 'loading'
    this.stopPositionHeartbeat()
    try {
      await this.mpv.play(audioUrl, title, startPosition)
      this.state = 'playing'
      this.startPositionHeartbeat()
      this.scheduleStatusEmit()
    } catch (err) {
      this.state = 'idle'
      this.stopPositionHeartbeat()
      this.scheduleStatusEmit()
      throw err
    }
  }

  private async pauseCurrentItem(): Promise<void> {
    try {
      const info = await this.mpv.getPlaybackInfo()
      if (info.playing || info.paused) {
        this.queue.pauseFront(info.position || 0)
      }
    } catch {
      this.queue.pauseFront(0)
    }
  }

  private async handleTrackEnd(): Promise<void> {
    if (this.mutex) {
      // Another operation is in progress — defer handling
      return
    }

    try {
      await this.withMutex(async () => {
        const current = this.queue.front()
        if (!current) {
          this.state = 'idle'
          this.stopPositionHeartbeat()
          this.scheduleStatusEmit()
          return
        }

        // Schedule items: always use default sequential behavior
        if (current.schedule_id) {
          const scheduleId = current.schedule_id
          let groupId: string | null = null

          const schedule = scheduleRepo.findById(scheduleId)
          if (schedule) {
            groupId = schedule.group_id
            scheduleRepo.updateStatus(scheduleId, 'completed')
          }

          this.queue.removeFront()

          if (groupId) {
            const continued = await this.triggerGroupContinuation(groupId)
            if (continued) return
          }

          await this.playFront()
          return
        }

        // Normal items: respect playback mode
        const mode = this.getPlaybackMode()

        switch (mode) {
          case 'repeat-one':
            await this.replayCurrent(current)
            break
          case 'repeat-all':
            this.queue.moveToBack(current.id)
            await this.playFront()
            break
          case 'shuffle':
            this.queue.removeFront()
            await this.playRandom()
            break
          case 'sequential':
          default:
            this.queue.removeFront()
            await this.playFront()
            break
        }
      })
    } catch {
      // Prevent crashes from propagating
    }
  }

  private async handleTrackError(): Promise<void> {
    if (this.mutex) return

    try {
      await this.withMutex(async () => {
        const current = this.queue.front()
        if (current?.schedule_id) {
          scheduleRepo.updateStatus(current.schedule_id, 'failed')
        }

        // Remove failed item
        this.queue.removeFront()

        // Try next
        await this.playFront()
      })
    } catch {
      // Prevent crashes from propagating
    }
  }

  private async handleProcessExit(): Promise<void> {
    // mpv crashed — treat same as track error
    await this.handleTrackError()
  }

  private getPlaybackMode(): PlaybackMode {
    try {
      return speakerRepo.getPlaybackMode(this.speakerId)
    } catch {
      return 'sequential'
    }
  }

  private async replayCurrent(item: QueueItem): Promise<void> {
    try {
      const track = await ytdlp.resolve(item.url)
      await this.startPlayback(track.audioUrl, item.title)
    } catch {
      // Failed to replay — fall back to sequential advance
      this.queue.removeFront()
      await this.playFront()
    }
  }

  private async playRandom(): Promise<void> {
    const item = this.queue.findRandomPending()
    if (!item) {
      this.state = 'idle'
      this.stopPositionHeartbeat()
      this.scheduleStatusEmit()
      return
    }

    this.queue.markPlaying(item.id)

    try {
      const track = await ytdlp.resolve(item.url)
      const startPosition = item.status === 'paused' ? (item.paused_position ?? undefined) : undefined
      await this.startPlayback(track.audioUrl, item.title, startPosition)
    } catch {
      // yt-dlp failed — remove and try another random
      this.queue.remove(item.id)
      await this.playRandom()
    }
  }

  private async playFront(): Promise<void> {
    const item = this.queue.findNextPlayable()
    if (!item) {
      this.state = 'idle'
      this.stopPositionHeartbeat()
      this.scheduleStatusEmit()
      return
    }

    // If it's a paused schedule item with completed schedule, skip it
    if (item.schedule_id && item.status === 'paused') {
      const schedule = scheduleRepo.findById(item.schedule_id)
      if (schedule && schedule.status === 'completed') {
        this.queue.remove(item.id)
        await this.playFront()
        return
      }
    }

    // Mark as playing
    this.queue.markPlaying(item.id)

    try {
      const track = await ytdlp.resolve(item.url)
      const startPosition = item.status === 'paused' ? (item.paused_position ?? undefined) : undefined
      await this.startPlayback(track.audioUrl, item.title, startPosition)
    } catch {
      // yt-dlp failed — remove and try next
      this.queue.remove(item.id)
      await this.playFront()
    }
  }

  private async withMutex<T>(fn: () => Promise<T>): Promise<T> {
    while (this.mutex) {
      await new Promise<void>((resolve) => {
        this.pendingCommands.push(resolve)
      })
    }

    this.mutex = true
    try {
      return await fn()
    } finally {
      this.mutex = false
      const next = this.pendingCommands.shift()
      if (next) next()
    }
  }

  setSpeakerName(name: string): void {
    this.speakerName = name
  }

  private handlePropertyChange(name: string): void {
    if (name === 'time-pos') return
    this.scheduleStatusEmit()
  }

  private scheduleStatusEmit(): void {
    if (this.state === 'loading') return
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null
      this.emit('status-change', this.getStatus())
    }, 16)
  }

  private startPositionHeartbeat(): void {
    this.stopPositionHeartbeat()
    this.positionHeartbeat = setInterval(() => {
      this.emit('status-change', this.getStatus())
    }, 2000)
  }

  private stopPositionHeartbeat(): void {
    if (this.positionHeartbeat) {
      clearInterval(this.positionHeartbeat)
      this.positionHeartbeat = null
    }
  }

  async destroy(): Promise<void> {
    this.stopPositionHeartbeat()
    if (this.emitTimer) {
      clearTimeout(this.emitTimer)
      this.emitTimer = null
    }
    this.removeAllListeners()
    await this.mpv.destroy()
  }
}
