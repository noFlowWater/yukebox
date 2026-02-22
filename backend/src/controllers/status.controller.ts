import type { FastifyRequest, FastifyReply } from 'fastify'
import { mpvService } from '../services/mpv.service.js'
import * as queueService from '../services/queue.service.js'
import * as scheduleService from '../services/schedule.service.js'
import { ok, fail } from '../types/api.js'

function computeHasNext(isIdle: boolean): boolean {
  if (!isIdle) return false
  return (
    queueService.getAll().length > 0 ||
    scheduleService.getAll().some((s) => s.status === 'playing')
  )
}

export async function handleStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const status = await mpvService.getStatus()
    status.has_next = computeHasNext(!status.playing && !status.paused)
    reply.status(200).send(ok(status))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('STATUS_ERROR', message))
  }
}

export async function handleStatusStream(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const sendStatus = async () => {
    try {
      const status = await mpvService.getStatus()
      status.has_next = computeHasNext(!status.playing && !status.paused)
      reply.raw.write(`data: ${JSON.stringify(status)}\n\n`)
    } catch {
      // skip on error, will retry next interval
    }
  }

  // Send initial status immediately
  await sendStatus()

  // Poll every second
  const interval = setInterval(sendStatus, 1000)

  request.raw.on('close', () => {
    clearInterval(interval)
  })
}
