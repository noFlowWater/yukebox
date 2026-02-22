import type { FastifyRequest, FastifyReply } from 'fastify'
import * as settingsService from '../services/settings.service.js'
import { updateSettingsSchema } from '../validators/settings.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleGet(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const defaultVolume = settingsService.getDefaultVolume()
    reply.status(200).send(ok({ default_volume: defaultVolume }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SETTINGS_ERROR', message))
  }
}

export async function handleUpdate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = updateSettingsSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    settingsService.setDefaultVolume(parsed.data.default_volume)
    reply.status(200).send(ok({ default_volume: parsed.data.default_volume }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SETTINGS_ERROR', message))
  }
}
