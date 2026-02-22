import type { FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { playSchema } from '../validators/play.validator.js'
import * as playService from '../services/play.service.js'
import { ok, fail } from '../types/api.js'

export async function handlePlay(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = playSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const result = await playService.play(parsed.data)
    reply.status(200).send(ok(result))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('PLAY_ERROR', message))
  }
}
