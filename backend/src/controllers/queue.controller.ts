import type { FastifyRequest, FastifyReply } from 'fastify'
import * as queueService from '../services/queue.service.js'
import { addToQueueSchema, bulkAddToQueueSchema, updatePositionSchema } from '../validators/queue.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleGetQueue(
  request: FastifyRequest<{ Querystring: { speaker_id?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const speakerIdParam = request.query.speaker_id
    const speakerId = speakerIdParam ? Number(speakerIdParam) : undefined
    if (speakerIdParam && (isNaN(speakerId!) || speakerId! <= 0)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker_id'))
      return
    }
    const items = queueService.getAll(speakerId)
    reply.status(200).send(ok(items))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_ERROR', message))
  }
}

export async function handleAddToQueue(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = addToQueueSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const item = await queueService.add(parsed.data)
    reply.status(201).send(ok(item))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_ADD_ERROR', message))
  }
}

export async function handleBulkAddToQueue(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = bulkAddToQueueSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const inputItems = parsed.data.items
      ?? parsed.data.urls!.map((url) => ({ url }))
    const items = await queueService.bulkAdd(inputItems, parsed.data.speaker_id)
    reply.status(201).send(ok(items))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_ADD_ERROR', message))
  }
}

export async function handleRemoveFromQueue(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt(request.params.id, 10)
    if (isNaN(id)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid id'))
      return
    }

    const removed = queueService.remove(id)
    if (!removed) {
      reply.status(404).send(fail('NOT_FOUND', 'Queue item not found'))
      return
    }

    reply.status(200).send(ok({ removed: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_REMOVE_ERROR', message))
  }
}

export async function handlePlayFromQueue(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt(request.params.id, 10)
    if (isNaN(id)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid id'))
      return
    }

    const item = await queueService.playItem(id)
    if (!item) {
      reply.status(404).send(fail('NOT_FOUND', 'Queue item not found'))
      return
    }

    reply.status(200).send(ok(item))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_PLAY_ERROR', message))
  }
}

export async function handleShuffleQueue(
  request: FastifyRequest<{ Querystring: { speaker_id?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const speakerIdParam = request.query.speaker_id
    const speakerId = speakerIdParam ? Number(speakerIdParam) : undefined
    if (speakerIdParam && (isNaN(speakerId!) || speakerId! <= 0)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker_id'))
      return
    }

    queueService.shuffle(speakerId)
    reply.status(200).send(ok({ shuffled: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_SHUFFLE_ERROR', message))
  }
}

export async function handleClearPending(
  request: FastifyRequest<{ Querystring: { speaker_id?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const speakerIdParam = request.query.speaker_id
    const speakerId = speakerIdParam ? Number(speakerIdParam) : undefined
    if (speakerIdParam && (isNaN(speakerId!) || speakerId! <= 0)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid speaker_id'))
      return
    }
    const removed = queueService.clearPending(speakerId)
    reply.status(200).send(ok({ removed }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_CLEAR_ERROR', message))
  }
}

export async function handleUpdatePosition(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt(request.params.id, 10)
    if (isNaN(id)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid id'))
      return
    }

    const parsed = updatePositionSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const updated = queueService.updatePosition(id, parsed.data.position)
    if (!updated) {
      reply.status(404).send(fail('NOT_FOUND', 'Queue item not found'))
      return
    }

    reply.status(200).send(ok({ updated: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('QUEUE_POSITION_ERROR', message))
  }
}
