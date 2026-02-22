import type { FastifyRequest, FastifyReply } from 'fastify'
import * as speakerService from '../services/speaker.service.js'
import { SpeakerError } from '../services/speaker.service.js'
import { registerSpeakerSchema, updateSpeakerSchema, updateSpeakerVolumeSchema } from '../validators/speaker.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleList(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const speakers = await speakerService.list()
    reply.status(200).send(ok(speakers))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}

export async function handleRegister(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = registerSpeakerSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const speaker = await speakerService.register(parsed.data.sink_name, parsed.data.display_name)
    reply.status(201).send(ok(speaker))
  } catch (err) {
    if (err instanceof SpeakerError) {
      if (err.code === 'SINK_NOT_FOUND') {
        reply.status(400).send(fail(err.code, err.message))
        return
      }
      if (err.code === 'DUPLICATE_SINK') {
        reply.status(409).send(fail(err.code, err.message))
        return
      }
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}

export async function handleRemove(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = Number(request.params.id)
    if (isNaN(id) || id <= 0) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker ID'))
      return
    }

    await speakerService.remove(id)
    reply.status(200).send(ok({ removed: true }))
  } catch (err) {
    if (err instanceof SpeakerError && err.code === 'NOT_FOUND') {
      reply.status(404).send(fail('NOT_FOUND', err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}

export async function handleSetDefault(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = Number(request.params.id)
    if (isNaN(id) || id <= 0) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker ID'))
      return
    }

    const speaker = await speakerService.setDefault(id)
    reply.status(200).send(ok(speaker))
  } catch (err) {
    if (err instanceof SpeakerError && err.code === 'NOT_FOUND') {
      reply.status(404).send(fail('NOT_FOUND', err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}

export async function handleActivate(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = Number(request.params.id)
    if (isNaN(id) || id <= 0) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker ID'))
      return
    }

    const speaker = await speakerService.activateSpeaker(id)
    reply.status(200).send(ok(speaker))
  } catch (err) {
    if (err instanceof SpeakerError && err.code === 'NOT_FOUND') {
      reply.status(404).send(fail('NOT_FOUND', err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}

export async function handleRename(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = Number(request.params.id)
    if (isNaN(id) || id <= 0) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker ID'))
      return
    }

    const parsed = updateSpeakerSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const speaker = await speakerService.rename(id, parsed.data.display_name)
    reply.status(200).send(ok(speaker))
  } catch (err) {
    if (err instanceof SpeakerError && err.code === 'NOT_FOUND') {
      reply.status(404).send(fail('NOT_FOUND', err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}

export async function handleUpdateVolume(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = Number(request.params.id)
    if (isNaN(id) || id <= 0) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker ID'))
      return
    }

    const parsed = updateSpeakerVolumeSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const speaker = await speakerService.updateDefaultVolume(id, parsed.data.default_volume)
    reply.status(200).send(ok(speaker))
  } catch (err) {
    if (err instanceof SpeakerError && err.code === 'NOT_FOUND') {
      reply.status(404).send(fail('NOT_FOUND', err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}

export async function handleAvailableSinks(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const sinks = await speakerService.getAvailableSinks()
    reply.status(200).send(ok(sinks))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SPEAKER_ERROR', message))
  }
}
