import * as queueRepo from '../repositories/queue.repository.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import { playbackManager } from './playback-manager.js'
import type { QueueItem } from '../types/queue.js'
import type { PlaybackMode } from '../types/speaker.js'

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
  const speakerId = resolveSpeakerId(input.speaker_id)
  if (!speakerId) {
    throw new Error('No speaker available')
  }

  const engine = playbackManager.getOrCreateEngine(speakerId)
  return await engine.addToQueue({
    url: input.url,
    query: input.query,
    title: input.title,
    thumbnail: input.thumbnail,
    duration: input.duration,
  })
}

export async function bulkAdd(
  inputItems: { url: string; title?: string; thumbnail?: string; duration?: number }[],
  speakerIdInput?: number,
): Promise<QueueItem[]> {
  const speakerId = resolveSpeakerId(speakerIdInput)
  if (!speakerId) {
    throw new Error('No speaker available')
  }

  const engine = playbackManager.getOrCreateEngine(speakerId)
  return await engine.addToQueueBulk(inputItems)
}

export function remove(id: number): boolean {
  const item = queueRepo.findById(id)
  if (!item) return false

  if (item.speaker_id) {
    const engine = playbackManager.getEngine(item.speaker_id)
    if (engine) {
      return engine.removeFromQueue(id)
    }
  }

  return queueRepo.remove(id)
}

export function clearPending(speakerId?: number): number {
  if (speakerId) {
    const engine = playbackManager.getEngine(speakerId)
    if (engine) {
      return engine.clearQueue()
    }
  }
  return queueRepo.clearPending(speakerId)
}

export function updatePosition(id: number, position: number): boolean {
  const item = queueRepo.findById(id)
  if (!item) return false

  if (item.speaker_id) {
    const engine = playbackManager.getEngine(item.speaker_id)
    if (engine) {
      return engine.reorderQueue(id, position)
    }
  }

  return queueRepo.updatePosition(id, position)
}

export async function playItem(id: number): Promise<QueueItem | null> {
  const item = queueRepo.findById(id)
  if (!item) return null

  const speakerId = item.speaker_id
  if (!speakerId) return null

  const engine = playbackManager.getOrCreateEngine(speakerId)
  return await engine.playFromQueue(id)
}

export function shuffle(speakerId?: number): void {
  if (speakerId) {
    const engine = playbackManager.getEngine(speakerId)
    if (engine) {
      engine.shuffleQueue()
      return
    }
  }
  queueRepo.shuffle(speakerId)
}

export function getPlaybackMode(speakerId?: number): PlaybackMode {
  const resolved = resolveSpeakerId(speakerId)
  if (!resolved) return 'sequential'
  try {
    return speakerRepo.getPlaybackMode(resolved)
  } catch {
    return 'sequential'
  }
}

export function setPlaybackMode(mode: PlaybackMode, speakerId?: number): PlaybackMode {
  const resolved = resolveSpeakerId(speakerId)
  if (!resolved) throw new Error('No speaker available')

  const speaker = speakerRepo.findById(resolved)
  if (!speaker) throw new Error('Speaker not found')

  speakerRepo.updatePlaybackMode(resolved, mode)
  return mode
}

function resolveSpeakerId(inputSpeakerId?: number): number | null {
  if (inputSpeakerId) {
    const speaker = speakerRepo.findById(inputSpeakerId)
    if (!speaker) throw new Error('Speaker not found')
    return speaker.id
  }

  const defaultSpeaker = speakerRepo.findDefault()
  return defaultSpeaker?.id ?? null
}
