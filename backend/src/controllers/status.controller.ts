import type { FastifyRequest, FastifyReply } from 'fastify'
import { playbackManager } from '../services/playback-manager.js'
import * as queueService from '../services/queue.service.js'
import { ok, fail } from '../types/api.js'

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
      reply.status(200).send(ok({
        playing: false,
        paused: false,
        title: '',
        url: '',
        duration: 0,
        position: 0,
        volume: 60,
        speaker_id: null,
        speaker_name: null,
        has_next: false,
      }))
      return
    }

    const status = await engine.getStatusAsync()
    reply.status(200).send(ok(status))
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

  const sendStatus = async () => {
    try {
      const engine = speakerId
        ? playbackManager.getEngine(speakerId)
        : playbackManager.getDefaultEngine()

      if (!engine) {
        reply.raw.write(`data: ${JSON.stringify({
          playing: false,
          paused: false,
          title: '',
          url: '',
          duration: 0,
          position: 0,
          volume: 60,
          speaker_id: null,
          speaker_name: null,
          has_next: false,
        })}\n\n`)
        return
      }

      const status = await engine.getStatusAsync()
      reply.raw.write(`data: ${JSON.stringify(status)}\n\n`)
    } catch {
      // skip on error, will retry next interval
    }
  }

  // Send initial status immediately
  sendStatus()

  // Poll every second
  const interval = setInterval(sendStatus, 1000)

  request.raw.on('close', () => {
    clearInterval(interval)
  })
}
