import { playbackManager } from './playback-manager.js'
import * as speakerRepo from '../repositories/speaker.repository.js'

export interface PlayResult {
  title: string
  url: string
  thumbnail: string
  duration: number
}

export async function play(input: {
  url?: string
  query?: string
  title?: string
  thumbnail?: string
  duration?: number
  speaker_id?: number
}): Promise<PlayResult> {
  const speakerId = resolveSpeakerId(input.speaker_id)
  if (!speakerId) {
    throw new Error('No speaker available')
  }

  const engine = playbackManager.getOrCreateEngine(speakerId)
  const result = await engine.playNow({
    url: input.url,
    query: input.query,
    title: input.title,
    thumbnail: input.thumbnail,
    duration: input.duration,
  })

  return result
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
