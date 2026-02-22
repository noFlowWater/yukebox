import type { FastifyRequest, FastifyReply } from 'fastify'
import { mpvService } from '../services/mpv.service.js'
import { volumeSchema, seekSchema } from '../validators/playback.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleStop(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await mpvService.stopPlayback()
    reply.status(200).send(ok({ stopped: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('STOP_ERROR', message))
  }
}

export async function handlePause(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await mpvService.pause()
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

    await mpvService.seekTo(parsed.data.position)
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

    await mpvService.setVolume(parsed.data.volume)
    reply.status(200).send(ok({ volume: parsed.data.volume }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('VOLUME_ERROR', message))
  }
}
