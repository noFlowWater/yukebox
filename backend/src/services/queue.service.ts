import * as queueRepo from '../repositories/queue.repository.js'
import * as ytdlp from './ytdlp.service.js'
import { mpvService } from './mpv.service.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import type { QueueItem } from '../types/queue.js'

// Suppress stop-event cleanup while queue/schedule is transitioning tracks
let suppressStopCleanup = false
let suppressStopTimer: ReturnType<typeof setTimeout> | null = null
// Suppress auto-advance while a schedule is actively playing
let suppressAutoAdvance = false

export function setSuppressStopCleanup(value: boolean): void {
  if (suppressStopTimer) {
    clearTimeout(suppressStopTimer)
    suppressStopTimer = null
  }
  if (value) {
    suppressStopCleanup = true
  } else {
    // Delay turning off to absorb stale stop events from mpv loadfile replace
    suppressStopTimer = setTimeout(() => {
      suppressStopCleanup = false
      suppressStopTimer = null
    }, 500)
  }
}

export function setSuppressAutoAdvance(value: boolean): void {
  suppressAutoAdvance = value
}

export function getAll(speakerId?: number): QueueItem[] {
  return queueRepo.findAll(speakerId)
}

export async function add(input: {
  url?: string
  query?: string
  title?: string
  thumbnail?: string
  duration?: number
  speaker_id?: number
}): Promise<QueueItem> {
  let resolvedUrl: string
  let title: string
  let thumbnail: string
  let duration: number

  // If metadata is provided, skip yt-dlp resolve (frontend already has it from search)
  if (input.url && input.title) {
    resolvedUrl = input.url
    title = input.title
    thumbnail = input.thumbnail ?? ''
    duration = input.duration ?? 0
  } else if (input.url) {
    const track = await ytdlp.resolve(input.url)
    resolvedUrl = track.url
    title = track.title
    thumbnail = track.thumbnail
    duration = track.duration
  } else if (input.query) {
    const results = await ytdlp.search(input.query, 1)
    if (results.length === 0) {
      throw new Error('No results found')
    }
    const track = await ytdlp.resolve(results[0].url)
    resolvedUrl = track.url
    title = track.title
    thumbnail = track.thumbnail
    duration = track.duration
  } else {
    throw new Error('Either url or query is required')
  }

  // Resolve speaker_id: explicit → active → default → null
  const speakerId = input.speaker_id ?? mpvService.getActiveSpeakerId() ?? speakerRepo.findDefault()?.id ?? null

  return queueRepo.insert({
    url: resolvedUrl,
    title,
    thumbnail,
    duration,
    speaker_id: speakerId,
  })
}

export async function bulkAdd(
  inputItems: { url: string; title?: string; thumbnail?: string; duration?: number }[],
  speakerIdInput?: number,
): Promise<QueueItem[]> {
  const speakerId = speakerIdInput ?? mpvService.getActiveSpeakerId() ?? speakerRepo.findDefault()?.id ?? null
  const items: QueueItem[] = []

  for (const input of inputItems) {
    try {
      let title: string
      let thumbnail: string
      let duration: number

      // If metadata is provided, skip yt-dlp resolve
      if (input.title) {
        title = input.title
        thumbnail = input.thumbnail ?? ''
        duration = input.duration ?? 0
      } else {
        const track = await ytdlp.resolve(input.url)
        title = track.title
        thumbnail = track.thumbnail
        duration = track.duration
      }

      const item = queueRepo.insert({
        url: input.url,
        title,
        thumbnail,
        duration,
        speaker_id: speakerId,
      })
      items.push(item)
    } catch {
      // Skip failed items
    }
  }

  return items
}

export function remove(id: number): boolean {
  return queueRepo.remove(id)
}

export function clearPending(speakerId?: number): number {
  return queueRepo.clearPending(speakerId)
}

export function updatePosition(id: number, position: number): boolean {
  return queueRepo.updatePosition(id, position)
}

export async function playItem(id: number): Promise<QueueItem | null> {
  const item = queueRepo.findById(id)
  if (!item) return null

  // Remove previously playing item, mark this one as playing
  queueRepo.removePlaying()
  queueRepo.markPlaying(id)

  suppressStopCleanup = true
  try {
    if (item.speaker_id && item.speaker_id !== mpvService.getActiveSpeakerId()) {
      const speaker = speakerRepo.findById(item.speaker_id)
      if (speaker) {
        if (mpvService.isConnected()) await mpvService.stop()
        mpvService.setActiveSpeaker(speaker.id, speaker.sink_name, speaker.display_name)
      }
    }

    const track = await ytdlp.resolve(item.url)
    await mpvService.play(track.audioUrl, track.title)
  } catch {
    // Play failed — remove the item
    queueRepo.remove(id)
  } finally {
    suppressStopCleanup = false
  }

  return item
}

export function shuffle(speakerId?: number): void {
  queueRepo.shuffle(speakerId)
}

export async function resumePaused(): Promise<QueueItem | null> {
  const paused = queueRepo.findPaused()
  if (!paused) return null

  queueRepo.markPlaying(paused.id)

  suppressStopCleanup = true
  try {
    if (paused.speaker_id && paused.speaker_id !== mpvService.getActiveSpeakerId()) {
      const speaker = speakerRepo.findById(paused.speaker_id)
      if (speaker) {
        if (mpvService.isConnected()) await mpvService.stop()
        mpvService.setActiveSpeaker(speaker.id, speaker.sink_name, speaker.display_name)
      }
    }

    const track = await ytdlp.resolve(paused.url)
    await mpvService.play(track.audioUrl, paused.title, paused.paused_position ?? undefined)
  } catch {
    queueRepo.remove(paused.id)
  } finally {
    suppressStopCleanup = false
  }

  return paused
}

export async function playNext(): Promise<QueueItem | null> {
  // Remove previously playing item
  queueRepo.removePlaying()

  // Resume paused item first (was interrupted by schedule)
  const paused = queueRepo.findPaused()
  if (paused) {
    return await resumePaused()
  }

  const next = queueRepo.findFirstPending()
  if (!next) return null

  // Mark as playing
  queueRepo.markPlaying(next.id)

  suppressStopCleanup = true
  try {
    // Switch speaker if queue item targets a different one
    if (next.speaker_id && next.speaker_id !== mpvService.getActiveSpeakerId()) {
      const speaker = speakerRepo.findById(next.speaker_id)
      if (speaker) {
        if (mpvService.isConnected()) await mpvService.stop()
        mpvService.setActiveSpeaker(speaker.id, speaker.sink_name, speaker.display_name)
      }
    }

    const track = await ytdlp.resolve(next.url)
    await mpvService.play(track.audioUrl, track.title)
  } catch {
    // If play fails, remove the item
    queueRepo.remove(next.id)
  } finally {
    suppressStopCleanup = false
  }

  return next
}

export function setupAutoAdvance(): void {
  mpvService.on('end-file', async (msg: { reason?: string }) => {
    if (msg.reason === 'eof') {
      if (!suppressAutoAdvance) {
        await playNext()
      }
    } else if (msg.reason === 'stop' && !suppressStopCleanup) {
      // User played something else (from search) — clean up stale playing state
      queueRepo.removePlaying()
    }
  })
}
