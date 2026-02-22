import { mpvService } from './mpv.service.js'
import * as ytdlp from './ytdlp.service.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import * as queueRepo from '../repositories/queue.repository.js'
import { setSuppressStopCleanup } from './queue.service.js'
import type { TrackInfo } from '../types/ytdlp.js'

export interface PlayResult {
  title: string
  url: string
  thumbnail: string
  duration: number
}

interface SpeakerInfo {
  id: number
  sink_name: string
  display_name: string
}

function resolveSpeaker(inputSpeakerId?: number): { speakerId: number | null; speakerToSwitch: SpeakerInfo | null } {
  let speakerId: number | null = inputSpeakerId ?? mpvService.getActiveSpeakerId()
  let speakerToSwitch: SpeakerInfo | null = null

  if (speakerId) {
    const speaker = speakerRepo.findById(speakerId)
    if (!speaker) throw new Error('Speaker not found')
    if (speakerId !== mpvService.getActiveSpeakerId()) {
      speakerToSwitch = speaker
    }
  } else {
    const defaultSpeaker = speakerRepo.findDefault()
    if (defaultSpeaker) {
      speakerId = defaultSpeaker.id
      if (defaultSpeaker.id !== mpvService.getActiveSpeakerId()) {
        speakerToSwitch = defaultSpeaker
      }
    }
  }

  return { speakerId, speakerToSwitch }
}

async function resolveAndPlay(
  url: string,
  queueItemId: number,
  speakerToSwitch: SpeakerInfo | null,
): Promise<void> {
  try {
    const track = await ytdlp.resolve(url)

    if (speakerToSwitch) {
      if (mpvService.isConnected()) await mpvService.stop()
      mpvService.setActiveSpeaker(speakerToSwitch.id, speakerToSwitch.sink_name, speakerToSwitch.display_name)
    }

    await mpvService.play(track.audioUrl, track.title)
  } catch {
    queueRepo.remove(queueItemId)
  } finally {
    setSuppressStopCleanup(false)
  }
}

export async function play(input: {
  url?: string
  query?: string
  title?: string
  thumbnail?: string
  duration?: number
  speaker_id?: number
}): Promise<PlayResult> {
  // 1. Validate speaker (fail fast)
  const { speakerId, speakerToSwitch } = resolveSpeaker(input.speaker_id)

  // 2. Fast path: metadata provided — insert into queue immediately, resolve+play in background
  if (input.url && input.title) {
    setSuppressStopCleanup(true)
    queueRepo.removePlaying()
    const queueItem = queueRepo.insertAtTop({
      url: input.url,
      title: input.title,
      thumbnail: input.thumbnail ?? '',
      duration: input.duration ?? 0,
      speaker_id: speakerId,
    })
    queueRepo.markPlaying(queueItem.id)

    // Fire-and-forget: resolve audio URL and play via mpv
    resolveAndPlay(input.url, queueItem.id, speakerToSwitch)

    return {
      title: input.title,
      url: input.url,
      thumbnail: input.thumbnail ?? '',
      duration: input.duration ?? 0,
    }
  }

  // 3. Slow path: no metadata — must resolve first
  let track: TrackInfo

  if (input.url) {
    track = await ytdlp.resolve(input.url)
  } else if (input.query) {
    const results = await ytdlp.search(input.query, 1)
    if (results.length === 0) {
      throw new Error('No results found')
    }
    track = await ytdlp.resolve(results[0].url)
  } else {
    throw new Error('Either url or query is required')
  }

  // Insert into queue at top and play
  setSuppressStopCleanup(true)
  queueRepo.removePlaying()
  const queueItem = queueRepo.insertAtTop({
    url: track.url,
    title: track.title,
    thumbnail: track.thumbnail,
    duration: track.duration,
    speaker_id: speakerId,
  })
  queueRepo.markPlaying(queueItem.id)

  try {
    if (speakerToSwitch) {
      if (mpvService.isConnected()) await mpvService.stop()
      mpvService.setActiveSpeaker(speakerToSwitch.id, speakerToSwitch.sink_name, speakerToSwitch.display_name)
    }

    await mpvService.play(track.audioUrl, track.title)
  } catch {
    queueRepo.remove(queueItem.id)
    throw new Error('Playback failed')
  } finally {
    setSuppressStopCleanup(false)
  }

  return {
    title: track.title,
    url: track.url,
    thumbnail: track.thumbnail,
    duration: track.duration,
  }
}
