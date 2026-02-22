import * as speakerRepo from '../repositories/speaker.repository.js'
import * as pulseService from './pulse.service.js'
import { mpvService } from './mpv.service.js'
import { toPublicSpeaker } from '../types/speaker.js'
import type { SpeakerPublic, AvailableSink } from '../types/speaker.js'

export class SpeakerError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'SpeakerError'
  }
}

export async function register(sinkName: string, displayName: string): Promise<SpeakerPublic> {
  try {
    const sinks = await pulseService.listSinks()
    const sink = sinks.find((s) => s.name === sinkName)
    if (!sink) {
      throw new SpeakerError('SINK_NOT_FOUND', `PulseAudio sink "${sinkName}" not found`)
    }

    const existing = speakerRepo.findBySinkName(sinkName)
    if (existing) {
      throw new SpeakerError('DUPLICATE_SINK', `Sink "${sinkName}" is already registered`)
    }

    const speaker = speakerRepo.insert(sinkName, displayName)

    if (speakerRepo.count() === 1) {
      speakerRepo.setDefault(speaker.id)
      speaker.is_default = 1
    }

    return toPublicSpeaker(speaker, true, sink.state)
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('REGISTER_ERROR', message)
  }
}

export async function remove(id: number): Promise<void> {
  try {
    const speaker = speakerRepo.findById(id)
    if (!speaker) {
      throw new SpeakerError('NOT_FOUND', 'Speaker not found')
    }

    const wasDefault = speaker.is_default === 1
    speakerRepo.remove(id)

    if (wasDefault) {
      const remaining = speakerRepo.findAll()
      if (remaining.length > 0) {
        speakerRepo.setDefault(remaining[0].id)
      }
    }
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('REMOVE_ERROR', message)
  }
}

export async function list(): Promise<SpeakerPublic[]> {
  try {
    const speakers = speakerRepo.findAll()
    let sinks: { name: string; state: string }[] = []
    try {
      sinks = await pulseService.listSinks()
    } catch {
      // pactl unavailable — all speakers shown as offline
    }

    const activeSpeakerId = mpvService.getActiveSpeakerId()
    const status = mpvService.isConnected() ? await mpvService.getStatus() : null
    const isPlaying = status?.playing ?? false

    return speakers.map((speaker) => {
      const sink = sinks.find((s) => s.name === speaker.sink_name)
      const active = speaker.id === activeSpeakerId
      const playing = active && isPlaying
      return toPublicSpeaker(speaker, !!sink, sink?.state ?? 'UNAVAILABLE', active, playing)
    })
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('LIST_ERROR', message)
  }
}

export async function activateSpeaker(id: number): Promise<SpeakerPublic> {
  try {
    const speaker = speakerRepo.findById(id)
    if (!speaker) {
      throw new SpeakerError('NOT_FOUND', 'Speaker not found')
    }

    if (mpvService.isConnected()) {
      await mpvService.stop()
    }

    mpvService.setActiveSpeaker(speaker.id, speaker.sink_name, speaker.display_name)

    let sinks: { name: string; state: string }[] = []
    try {
      sinks = await pulseService.listSinks()
    } catch {
      // pactl unavailable
    }
    const sink = sinks.find((s) => s.name === speaker.sink_name)
    return toPublicSpeaker(speaker, !!sink, sink?.state ?? 'UNAVAILABLE', true, false)
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('ACTIVATE_ERROR', message)
  }
}

export async function getDefault(): Promise<SpeakerPublic | null> {
  try {
    const speaker = speakerRepo.findDefault()
    if (!speaker) return null

    let sinks: { name: string; state: string }[] = []
    try {
      sinks = await pulseService.listSinks()
    } catch {
      // pactl unavailable
    }

    const sink = sinks.find((s) => s.name === speaker.sink_name)
    return toPublicSpeaker(speaker, !!sink, sink?.state ?? 'UNAVAILABLE')
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('DEFAULT_ERROR', message)
  }
}

export async function rename(id: number, displayName: string): Promise<SpeakerPublic> {
  try {
    const speaker = speakerRepo.findById(id)
    if (!speaker) {
      throw new SpeakerError('NOT_FOUND', 'Speaker not found')
    }

    speakerRepo.update(id, displayName)

    const updated = speakerRepo.findById(id)!

    let sinks: { name: string; state: string }[] = []
    try {
      sinks = await pulseService.listSinks()
    } catch {
      // pactl unavailable
    }

    const sink = sinks.find((s) => s.name === updated.sink_name)
    return toPublicSpeaker(updated, !!sink, sink?.state ?? 'UNAVAILABLE')
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('RENAME_ERROR', message)
  }
}

export async function setDefault(id: number): Promise<SpeakerPublic> {
  try {
    const speaker = speakerRepo.findById(id)
    if (!speaker) {
      throw new SpeakerError('NOT_FOUND', 'Speaker not found')
    }

    speakerRepo.setDefault(id)

    let sinks: { name: string; state: string }[] = []
    try {
      sinks = await pulseService.listSinks()
    } catch {
      // pactl unavailable
    }

    const sink = sinks.find((s) => s.name === speaker.sink_name)
    return toPublicSpeaker({ ...speaker, is_default: 1 }, !!sink, sink?.state ?? 'UNAVAILABLE')
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('SET_DEFAULT_ERROR', message)
  }
}

export async function getAvailableSinks(): Promise<AvailableSink[]> {
  try {
    const sinks = await pulseService.listSinks()
    const registered = speakerRepo.findAll()
    const registeredNames = new Set(registered.map((s) => s.sink_name))

    const available: AvailableSink[] = []

    for (const sink of sinks) {
      if (registeredNames.has(sink.name)) continue

      let description = sink.name
      try {
        const detail = await pulseService.getSinkDetails(sink.name)
        if (detail) {
          description = detail.description
        }
      } catch {
        // fallback to sink name
      }

      available.push({
        sink_name: sink.name,
        description,
        state: sink.state,
      })
    }

    return available
  } catch (err) {
    if (err instanceof SpeakerError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new SpeakerError('AVAILABLE_ERROR', message)
  }
}
