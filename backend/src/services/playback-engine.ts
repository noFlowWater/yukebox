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

interface ScheduleTrigger {
  id: number
  url: string
  query: string
  title: string
  thumbnail: string
  duration: number
  group_id: string | null
}

interface ResolvedTrack {
  url: string
  title: string
  thumbnail: string
  duration: number
  audioUrl: string
}

const MAX_HISTORY = 500

// Automatic advance stops after this many failures in a row, so a systemic
// problem (outdated yt-dlp, network outage, missing sink) cannot burn through
// the whole queue. Failed items stay in the queue with status 'failed'.
export const MAX_CONSECUTIVE_FAILURES = 3

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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
  private playHistory: HistoryEntry[] = []
  private consecutiveFailures = 0

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
    this.mpv.on('track-loaded', () => { this.consecutiveFailures = 0 })
    this.mpv.on('track-error', (err: Error) => this.handleTrackError(err))
    this.mpv.on('process-exit', (code: number | null) => this.handleProcessExit(code))
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
      this.consecutiveFailures = 0

      // Resolve the audio stream before touching current playback, so a
      // failure leaves the current track playing and the queue untouched
      const { url, title, thumbnail, duration, audioUrl } = await this.resolveInput(input)

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

      try {
        await this.startPlayback(audioUrl, title)
      } catch (err) {
        this.recordFailure(queueItem, err)
        throw err
      }

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
      this.consecutiveFailures = 0

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
      this.consecutiveFailures = 0

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
      } catch (err) {
        // Skip items that cannot be resolved — they are never inserted
        this.logWarning(`bulk add skipped ${item.url}: ${errorMessage(err)}`)
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

      this.consecutiveFailures = 0

      // Resolve before touching current playback — on failure the item stays
      // in place marked 'failed' and the current track keeps playing
      let track: ResolvedTrack
      try {
        track = await ytdlp.resolve(item.url)
      } catch (err) {
        this.recordFailure(item, err)
        throw err
      }

      // If currently playing, push to history and pause current item
      if (this.state === 'playing' || this.state === 'paused') {
        this.pushCurrentToHistory()
        await this.pauseCurrentItem()
      }

      // Move target to front (paused item remains behind it)
      const moved = this.queue.moveToFront(id)
      if (!moved) return null

      this.queue.markPlaying(moved.id)

      try {
        await this.startPlayback(track.audioUrl, moved.title)
      } catch (err) {
        this.recordFailure(moved, err)
        throw err
      }

      return moved
    })
  }

  // --- Schedule trigger ---

  async triggerSchedule(schedule: ScheduleTrigger): Promise<void> {
    return await this.withMutex(async () => {
      await this.startSchedule(schedule)
    })
  }

  // Must be called while holding the mutex. Returns true when playback was
  // taken over (started, or failed and handed off to the next item), false
  // when nothing changed and the caller should decide what plays next.
  private async startSchedule(schedule: ScheduleTrigger): Promise<boolean> {
    this.consecutiveFailures = 0

    // Resolve first — a failed schedule must not interrupt current playback
    let track: ResolvedTrack
    try {
      if (schedule.url) {
        track = await ytdlp.resolve(schedule.url)
      } else {
        const results = await ytdlp.search(schedule.query, 1)
        if (results.length === 0) throw new Error('No results found')
        track = await ytdlp.resolve(results[0].url)
      }
    } catch (err) {
      this.logWarning(`schedule ${schedule.id} "${schedule.title}" failed to resolve: ${errorMessage(err)}`)
      scheduleRepo.updateStatus(schedule.id, 'failed')
      return false
    }

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
    const queueItem = this.queue.insertAtFront({
      url: schedule.url,
      title: schedule.title,
      thumbnail: schedule.thumbnail,
      duration: schedule.duration,
      schedule_id: schedule.id,
    })
    this.queue.markPlaying(queueItem.id)

    try {
      await this.startPlayback(track.audioUrl, schedule.title)
      scheduleRepo.updateStatus(schedule.id, 'playing')
    } catch (err) {
      this.recordFailure(queueItem, err)
      await this.continueAfterFailure()
    }
    return true
  }

  private async triggerGroupContinuation(groupId: string): Promise<boolean> {
    const pending = scheduleRepo.findPendingByGroup(groupId)
    if (pending.length === 0) return false

    const next = pending[0]
    if (next.speaker_id !== this.speakerId) return false

    // Called from advanceToNext, which already holds the mutex — going through
    // triggerSchedule here would wait on our own lock forever
    return await this.startSchedule({
      id: next.id,
      url: next.url,
      query: next.query,
      title: next.title,
      thumbnail: next.thumbnail,
      duration: next.duration,
      group_id: next.group_id,
    })
  }

  // --- Internal ---

  private async resolveInput(input: {
    url?: string
    query?: string
    title?: string
    thumbnail?: string
    duration?: number
  }): Promise<ResolvedTrack> {
    let url = input.url
    if (!url) {
      if (!input.query) throw new Error('Either url or query is required')
      const results = await ytdlp.search(input.query, 1)
      if (results.length === 0) throw new Error('No results found')
      url = results[0].url
    }

    const track = await ytdlp.resolve(url)

    // Keep caller-provided metadata (e.g. from search results) when present
    if (input.url && input.title) {
      return {
        url: input.url,
        title: input.title,
        thumbnail: input.thumbnail ?? '',
        duration: input.duration ?? 0,
        audioUrl: track.audioUrl,
      }
    }
    return track
  }

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
    let item = items.find((i) => i.url === entry.url && i.status !== 'playing')

    if (!item) {
      // Item was deleted from queue — re-insert at front
      item = this.queue.insertAtFront({
        url: entry.url,
        title: entry.title,
        thumbnail: entry.thumbnail,
        duration: entry.duration,
      })
    }
    this.queue.markPlaying(item.id)

    try {
      const track = await ytdlp.resolve(entry.url)
      await this.startPlayback(track.audioUrl, entry.title)
    } catch (err) {
      this.recordFailure(item, err)
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
    } catch (err) {
      // Prevent crashes from propagating
      this.logWarning(`track end handling failed: ${errorMessage(err)}`)
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

  private async handleTrackError(err: Error): Promise<void> {
    if (this.mutex) return

    try {
      await this.withMutex(async () => {
        const current = this.queue.findPlaying()
        if (!current) {
          this.transitionToIdle()
          return
        }

        this.recordFailure(current, err)
        await this.continueAfterFailure()
      })
    } catch (handlerErr) {
      // Prevent crashes from propagating
      this.logWarning(`track error handling failed: ${errorMessage(handlerErr)}`)
    }
  }

  private async handleProcessExit(code: number | null): Promise<void> {
    // mpv crashed — treat same as track error
    await this.handleTrackError(new Error(`mpv exited unexpectedly (code ${code})`))
  }

  // Keeps the item in the queue as 'failed' — playback failures never delete
  // queue items. The user can retry or remove it explicitly.
  private recordFailure(item: QueueItem, err: unknown): void {
    this.consecutiveFailures++
    this.queue.markFailed(item.id)
    if (item.schedule_id) {
      scheduleRepo.updateStatus(item.schedule_id, 'failed')
    }
    this.logWarning(
      `failed to play queue item ${item.id} "${item.title}" ` +
      `(${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${errorMessage(err)}`,
    )
  }

  // Skip past a failed item following the playback mode, unless too many
  // failures happened in a row — then stop and leave the rest of the queue as is.
  private async continueAfterFailure(): Promise<void> {
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.logWarning(`stopping playback after ${this.consecutiveFailures} consecutive failures`)
      this.transitionToIdle()
      return
    }

    const mode = this.getPlaybackMode()
    if (mode === 'shuffle') {
      if (this.queue.findRandomPending()) {
        await this.playRandom()
      } else {
        this.endCycle()
      }
    } else if (mode === 'repeat-all') {
      await this.playFront()
    } else if (this.queue.findNextPlayable()) {
      await this.playFront()
    } else {
      this.endCycle()
    }
  }

  private logWarning(message: string): void {
    console.warn(`[playback] speaker ${this.speakerId}: ${message}`)
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
    } catch (err) {
      this.recordFailure(item, err)
      await this.continueAfterFailure()
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
    } catch (err) {
      this.recordFailure(item, err)
      await this.continueAfterFailure()
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
    } catch (err) {
      this.recordFailure(item, err)
      await this.continueAfterFailure()
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
