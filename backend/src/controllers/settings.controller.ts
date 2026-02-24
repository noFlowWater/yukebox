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
    const btAutoRegister = settingsService.getBtAutoRegister()
    const btAutoReconnect = settingsService.getBtAutoReconnect()
    const btMonitoringInterval = settingsService.getBtMonitoringInterval()
    const btScanDuration = settingsService.getBtScanDuration()
    reply.status(200).send(ok({
      default_volume: defaultVolume,
      bt_auto_register: btAutoRegister,
      bt_auto_reconnect: btAutoReconnect,
      bt_monitoring_interval: btMonitoringInterval,
      bt_scan_duration: btScanDuration,
    }))
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

    if (parsed.data.default_volume !== undefined) {
      settingsService.setDefaultVolume(parsed.data.default_volume)
    }
    if (parsed.data.bt_auto_register !== undefined) {
      settingsService.setBtAutoRegister(parsed.data.bt_auto_register)
    }
    if (parsed.data.bt_auto_reconnect !== undefined) {
      settingsService.setBtAutoReconnect(parsed.data.bt_auto_reconnect)
    }
    if (parsed.data.bt_monitoring_interval !== undefined) {
      settingsService.setBtMonitoringInterval(parsed.data.bt_monitoring_interval)
    }
    if (parsed.data.bt_scan_duration !== undefined) {
      settingsService.setBtScanDuration(parsed.data.bt_scan_duration)
    }

    reply.status(200).send(ok({
      default_volume: settingsService.getDefaultVolume(),
      bt_auto_register: settingsService.getBtAutoRegister(),
      bt_auto_reconnect: settingsService.getBtAutoReconnect(),
      bt_monitoring_interval: settingsService.getBtMonitoringInterval(),
      bt_scan_duration: settingsService.getBtScanDuration(),
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('SETTINGS_ERROR', message))
  }
}
