import type { FastifyRequest, FastifyReply } from 'fastify'
import { playbackManager } from '../services/playback-manager.js'
import { volumeSchema, seekSchema } from '../validators/playback.validator.js'
import { ok, fail } from '../types/api.js'

function resolveEngine(speakerId?: number) {
  if (speakerId) {
    const engine = playbackManager.getEngine(speakerId)
    if (!engine) throw new Error('No active engine for this speaker')
    return engine
  }
  const engine = playbackManager.getDefaultEngine()
  if (!engine) throw new Error('No active playback engine')
  return engine
}

export async function handleStop(
  request: FastifyRequest<{ Body: { speaker_id?: number } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const speakerId = (request.body as { speaker_id?: number } | undefined)?.speaker_id
    const engine = resolveEngine(speakerId)
    await engine.stop()
    reply.status(200).send(ok({ stopped: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('STOP_ERROR', message))
  }
}

export async function handlePause(
  request: FastifyRequest<{ Body: { speaker_id?: number } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const speakerId = (request.body as { speaker_id?: number } | undefined)?.speaker_id
    const engine = resolveEngine(speakerId)
    await engine.togglePause()
    reply.status(200).send(ok({ toggled: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('PAUSE_ERROR', message))
  }
}

export async function handleSeek(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = seekSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const speakerId = (request.body as { speaker_id?: number } | undefined)?.speaker_id
    const engine = resolveEngine(speakerId)
    await engine.seek(parsed.data.position)
    reply.status(200).send(ok({ position: parsed.data.position }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SEEK_ERROR', message))
  }
}

export async function handleVolume(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = volumeSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const speakerId = (request.body as { speaker_id?: number } | undefined)?.speaker_id
    const engine = resolveEngine(speakerId)
    await engine.setVolume(parsed.data.volume)
    reply.status(200).send(ok({ volume: parsed.data.volume }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('VOLUME_ERROR', message))
  }
}
