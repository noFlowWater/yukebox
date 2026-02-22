import type { FastifyRequest, FastifyReply } from 'fastify'
import * as ytdlp from '../services/ytdlp.service.js'
import { searchSchema, resolveSchema } from '../validators/search.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleSearch(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = searchSchema.safeParse(request.query)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const results = await ytdlp.search(parsed.data.query, parsed.data.limit)
    reply.status(200).send(ok(results))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SEARCH_ERROR', message))
  }
}

export async function handleResolve(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = resolveSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const track = await ytdlp.resolve(parsed.data.url)
    reply.status(200).send(ok({
      url: track.url,
      title: track.title,
      thumbnail: track.thumbnail,
      duration: track.duration,
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('RESOLVE_ERROR', message))
  }
}
