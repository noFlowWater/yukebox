import type { FastifyRequest, FastifyReply } from 'fastify'
import * as ytdlp from '../services/ytdlp.service.js'
import { youtubeDetailsSchema } from '../validators/youtube.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleYoutubeDetails(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = youtubeDetailsSchema.safeParse(request.query)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const details = await ytdlp.getVideoDetails(parsed.data.url)
    reply.status(200).send(ok(details))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('not found') || message.includes('unavailable') || message.includes('Video unavailable')) {
      reply.status(404).send(fail('NOT_FOUND', 'Video not found or unavailable'))
      return
    }
    reply.status(500).send(fail('YOUTUBE_ERROR', message))
  }
}
