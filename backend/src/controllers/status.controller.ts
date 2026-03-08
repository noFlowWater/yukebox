import type { FastifyRequest, FastifyReply } from 'fastify'
import { playbackManager } from '../services/playback-manager.js'
import * as queueService from '../services/queue.service.js'
import { ok, fail } from '../types/api.js'
import { EMPTY_STATUS, type MpvStatus } from '../types/mpv.js'

export async function handleStatus(
  request: FastifyRequest<{ Querystring: { speaker_id?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const speakerIdParam = request.query.speaker_id
    const speakerId = speakerIdParam ? Number(speakerIdParam) : undefined

    const engine = speakerId
      ? playbackManager.getEngine(speakerId)
      : playbackManager.getDefaultEngine()

    if (!engine) {
      reply.status(200).send(ok({ ...EMPTY_STATUS }))
      return
    }

    const status = engine.getStatus()
    reply.status(200).send(ok(status))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('STATUS_ERROR', message))
  }
}

export async function handleStatusAll(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const statuses = await playbackManager.getAllStatusesAsync()

    // Attach queue_count for each speaker
    const enriched = statuses.map((status) => {
      const speakerId = status.speaker_id
      const queueItems = speakerId ? queueService.getAll(speakerId) : []
      const queueCount = queueItems.filter((item) => item.status === 'pending').length
      return { ...status, queue_count: queueCount }
    })

    reply.status(200).send(ok(enriched))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('STATUS_ERROR', message))
  }
}

export async function handleStatusStream(
  request: FastifyRequest<{ Querystring: { speaker_id?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const speakerIdParam = request.query.speaker_id
  const speakerId = speakerIdParam ? Number(speakerIdParam) : undefined

  const engine = speakerId
    ? playbackManager.getEngine(speakerId)
    : playbackManager.getDefaultEngine()

  if (!engine) {
    reply.raw.write(`data: ${JSON.stringify(EMPTY_STATUS)}\n\n`)
    reply.raw.end()
    return
  }

  // Send initial status first
  reply.raw.write(`data: ${JSON.stringify(engine.getStatus())}\n\n`)

  // Then subscribe to events (prevents duplicate initial push)
  const onStatusChange = (status: MpvStatus) => {
    try {
      reply.raw.write(`data: ${JSON.stringify(status)}\n\n`)
    } catch {
      // connection closed
    }
  }
  engine.on('status-change', onStatusChange)

  // SSE keepalive (idle/paused state — prevent proxy timeout)
  const keepalive = setInterval(() => {
    try {
      reply.raw.write(': keepalive\n\n')
    } catch {
      // connection closed
    }
  }, 30_000)

  request.raw.on('close', () => {
    engine.removeListener('status-change', onStatusChange)
    clearInterval(keepalive)
  })
}
