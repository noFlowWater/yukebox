import type { FastifyRequest, FastifyReply } from 'fastify'
import * as scheduleService from '../services/schedule.service.js'
import { createScheduleSchema, updateScheduleTimeSchema } from '../validators/schedule.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleGetSchedules(
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
    const schedules = scheduleService.getAll(speakerId)
    reply.status(200).send(ok(schedules))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SCHEDULE_ERROR', message))
  }
}

export async function handleCreateSchedule(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = createScheduleSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const { schedule, warning } = scheduleService.create(parsed.data)
    const response: Record<string, unknown> = { success: true, data: schedule }
    if (warning) {
      response.warning = warning
    }
    reply.status(201).send(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SCHEDULE_CREATE_ERROR', message))
  }
}

export async function handleDeleteAllSchedules(
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
    const count = scheduleService.removeAll(speakerId)
    reply.status(200).send(ok({ removed: count }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SCHEDULE_DELETE_ERROR', message))
  }
}

export async function handleUpdateScheduleTime(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt(request.params.id, 10)
    if (isNaN(id)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid id'))
      return
    }

    const parsed = updateScheduleTimeSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const { updated, warning } = scheduleService.updateScheduledTime(id, parsed.data.scheduled_at)
    const response: Record<string, unknown> = { success: true, data: updated }
    if (warning) {
      response.warning = warning
    }
    reply.status(200).send(response)
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string }
    const statusCode = error.statusCode ?? 500
    const code = error.code ?? 'SCHEDULE_UPDATE_ERROR'
    reply.status(statusCode).send(fail(code, error.message ?? 'Unknown error'))
  }
}

export async function handleDeleteSchedule(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt(request.params.id, 10)
    if (isNaN(id)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid id'))
      return
    }

    const removed = scheduleService.remove(id)
    if (!removed) {
      reply.status(404).send(fail('NOT_FOUND', 'Schedule not found'))
      return
    }

    reply.status(200).send(ok({ removed: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SCHEDULE_DELETE_ERROR', message))
  }
}
