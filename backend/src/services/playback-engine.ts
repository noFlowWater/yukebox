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

interface HistoryEntry {
  url: string
  title: string
  thumbnail: string
  duration: number
}

const MAX_HISTORY = 500

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
  private playHistory: HistoryEntry[] = []

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

      // If currently playing, push to history and pause current item
      if (this.state === 'playing' || this.state === 'paused') {
        this.pushCurrentToHistory()
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

      // Keep the current item in queue as pending instead of removing
      this.queue.resetPlayingToPending()
      this.transitionToIdle()
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
      this.transitionToPlaying()
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

  async skip(): Promise<void> {
    return await this.withMutex(async () => {
      if (this.state === 'idle') return

      const current = this.queue.findPlaying()
      if (!current) {
        this.transitionToIdle()
        return
      }

      // Push to history before advancing (exclude schedule items)
      if (!current.schedule_id) {
        this.pushCurrentToHistory()
      }

      // Stop mpv first — unlike handleTrackEnd, mpv is still playing
      try {
        await this.mpv.stopPlayback()
      } catch {
        // mpv may already be stopped
      }

      // Advance with forceAdvance=true so repeat-one still skips forward
      await this.advanceToNext(current, true)
    })
  }

  async previous(): Promise<void> {
    return await this.withMutex(async () => {
      if (this.state === 'idle') return

      // Check 3-second rule using live position
      let position = 0
      try {
        const info = await this.mpv.getPlaybackInfo()
        position = info.position
      } catch {
        // If we can't get position, treat as restart
      }

      // Position >= 3s — restart current track
      if (position >= 3) {
        await this.mpv.seekTo(0)
        if (this.state === 'paused') {
          await this.mpv.resume()
          this.transitionToPlaying()
        }
        return
      }

      // Position < 3s — go to previous from history
      if (this.playHistory.length === 0) {
        // No history — restart current
        await this.mpv.seekTo(0)
        if (this.state === 'paused') {
          await this.mpv.resume()
          this.transitionToPlaying()
        }
        return
      }

      const prev = this.playHistory.pop()!

      // Stop current playback
      try {
        await this.mpv.stopPlayback()
      } catch {
        // mpv may already be stopped
      }

      // Pause current item (save position) so it stays in queue
      const current = this.queue.findPlaying()
      if (current) {
        this.queue.pauseFront(position)
      }

      // Play the previous track
      await this.playSpecificItem(prev)
    })
  }

  getStatus(): MpvStatus {
    const current = this.queue.findPlaying() ?? this.queue.front()
    const isPlaying = this.state === 'playing' || this.state === 'loading'
    const isPaused = this.state === 'paused'

    const hasNext = this.queue.hasNextPlayable()

    // Enrich with cached MPV data when connected
    const cached = this.mpv.getCachedPlaybackInfo()

    return {
      playing: isPlaying,
      paused: isPaused,
      title: (isPlaying || isPaused) && current ? current.title : '',
      url: (isPlaying || isPaused) && current ? current.url : '',
      duration: (isPlaying || isPaused) && current ? (cached.duration || current.duration) : 0,
      position: (isPlaying || isPaused) ? cached.position : 0,
      volume: cached.volume ?? this.defaultVolume,
      speaker_id: this.speakerId,
      speaker_name: this.speakerName,
      has_next: hasNext,
      has_previous: this.playHistory.length > 0,
      playback_mode: this.getPlaybackMode(),
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

      // If currently playing, push to history and pause current item
      if (this.state === 'playing' || this.state === 'paused') {
        this.pushCurrentToHistory()
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
      this.transitionToPlaying()
    } catch (err) {
      this.transitionToIdle()
      throw err
    }
  }

  private pushCurrentToHistory(): void {
    const current = this.queue.findPlaying()
    if (!current) return
    this.playHistory.push({
      url: current.url,
      title: current.title,
      thumbnail: current.thumbnail,
      duration: current.duration,
    })
    if (this.playHistory.length > MAX_HISTORY) {
      this.playHistory.splice(0, this.playHistory.length - MAX_HISTORY)
    }
  }

  private async playSpecificItem(entry: HistoryEntry): Promise<void> {
    // Find in queue by URL, or re-insert
    const items = this.queue.getAll()
    let item = items.find((i) => i.url === entry.url && (i.status === 'pending' || i.status === 'paused' || i.status === 'played'))

    if (item) {
      this.queue.markPlaying(item.id)
    } else {
      // Item was deleted from queue — re-insert at front
      const created = this.queue.insertAtFront({
        url: entry.url,
        title: entry.title,
        thumbnail: entry.thumbnail,
        duration: entry.duration,
      })
      this.queue.markPlaying(created.id)
    }

    try {
      const track = await ytdlp.resolve(entry.url)
      await this.startPlayback(track.audioUrl, entry.title)
    } catch {
      // yt-dlp failed — transition to idle
      this.transitionToIdle()
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
        const current = this.queue.findPlaying()
        if (!current) {
          this.transitionToIdle()
          return
        }

        // Push to history before advancing (exclude schedule items)
        if (!current.schedule_id) {
          this.pushCurrentToHistory()
        }

        await this.advanceToNext(current, false)
      })
    } catch {
      // Prevent crashes from propagating
    }
  }

  private async advanceToNext(current: QueueItem, forceAdvance: boolean): Promise<void> {
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

    // repeat-one: replay unless user explicitly skipped
    if (mode === 'repeat-one' && !forceAdvance) {
      await this.replayCurrent(current)
      return
    }

    switch (mode) {
      case 'repeat-all':
        this.queue.moveToBack(current.id)
        await this.playFront()
        break
      case 'shuffle':
        this.queue.markPlayed(current.id)
        if (this.queue.findRandomPending()) {
          await this.playRandom()
        } else {
          this.endCycle()
        }
        break
      case 'repeat-one':
      case 'sequential':
      default:
        this.queue.markPlayed(current.id)
        if (this.queue.findNextPlayable()) {
          await this.playFront()
        } else {
          this.endCycle()
        }
        break
    }
  }

  private async handleTrackError(): Promise<void> {
    if (this.mutex) return

    try {
      await this.withMutex(async () => {
        const current = this.queue.findPlaying()
        if (current?.schedule_id) {
          scheduleRepo.updateStatus(current.schedule_id, 'failed')
        }

        // Remove failed item
        if (current) this.queue.remove(current.id)

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
    let item = this.queue.findRandomPending()
    if (!item && this.queue.hasPlayed()) {
      this.queue.resetPlayedToPending()
      item = this.queue.findRandomPending()
    }
    if (!item) {
      this.transitionToIdle()
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
    let item = this.queue.findNextPlayable()
    if (!item && this.queue.hasPlayed()) {
      this.queue.resetPlayedToPending()
      item = this.queue.findNextPlayable()
    }
    if (!item) {
      this.transitionToIdle()
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

  private transitionToIdle(): void {
    this.state = 'idle'
    this.stopPositionHeartbeat()
    this.scheduleStatusEmit()
  }

  private endCycle(): void {
    this.playHistory = []
    this.transitionToIdle()
    // Reset played items after SSE emit (16ms) so frontend sees has_next: false first
    setTimeout(() => {
      this.queue.resetPlayedToPending()
    }, 50)
  }

  private transitionToPlaying(): void {
    this.state = 'playing'
    this.startPositionHeartbeat()
    this.scheduleStatusEmit()
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
