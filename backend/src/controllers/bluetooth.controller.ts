import type { FastifyRequest, FastifyReply } from 'fastify'
import * as bluetoothService from '../services/bluetooth.service.js'
import { BluetoothError } from '../services/bluetooth.service.js'
import * as btRepo from '../repositories/bluetooth.repository.js'
import * as settingsService from '../services/settings.service.js'
import { btAddressParamSchema, btScanQuerySchema } from '../validators/bluetooth.validator.js'
import { toPublicBluetoothDevice } from '../types/bluetooth.js'
import { ok, fail } from '../types/api.js'

export async function handleAdapterStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const status = await bluetoothService.getAdapterStatus()
    reply.status(200).send(ok(status))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('BLUETOOTH_ERROR', message))
  }
}

export async function handleDevices(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await bluetoothService.getPairedDevices()
    const devices = btRepo.findAllWithSpeaker()
    const result = devices.map((d) => toPublicBluetoothDevice(d, d.speaker_id, d.speaker_name))
    reply.status(200).send(ok(result))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('BLUETOOTH_ERROR', message))
  }
}

export async function handleScanStream(
  request: FastifyRequest<{ Querystring: { duration?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  try {
    const parsed = btScanQuerySchema.safeParse(request.query)
    const duration = parsed.success && parsed.data.duration
      ? parsed.data.duration
      : settingsService.getBtScanDuration()

    const status = await bluetoothService.getAdapterStatus()
    if (!status.available || !status.powered) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ code: 'ADAPTER_UNAVAILABLE', message: 'Bluetooth adapter not available' })}\n\n`)
      reply.raw.end()
      return
    }

    bluetoothService.scanDevices(
      duration,
      (device) => {
        try {
          reply.raw.write(`event: device\ndata: ${JSON.stringify(device)}\n\n`)
        } catch {
          // client may have disconnected
        }
      },
      (scanned) => {
        try {
          reply.raw.write(`event: done\ndata: ${JSON.stringify({ scanned, duration })}\n\n`)
          reply.raw.end()
        } catch {
          // client may have disconnected
        }
      },
    )

    request.raw.on('close', () => {
      bluetoothService.stopScan()
    })
  } catch (err) {
    const code = err instanceof BluetoothError ? err.code : 'BLUETOOTH_ERROR'
    const message = err instanceof Error ? err.message : 'Unknown error'
    try {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ code, message })}\n\n`)
      reply.raw.end()
    } catch {
      // already closed
    }
  }
}

export async function handleConnect(
  request: FastifyRequest<{ Params: { address: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = btAddressParamSchema.safeParse(request.params)
    if (!parsed.success) {
      reply.status(400).send(fail('INVALID_ADDRESS', 'Invalid BT MAC format'))
      return
    }

    const result = await bluetoothService.connectDevice(parsed.data.address)
    reply.status(200).send(ok(result))
  } catch (err) {
    if (err instanceof BluetoothError) {
      const statusMap: Record<string, number> = {
        INVALID_ADDRESS: 400,
        DEVICE_NOT_FOUND: 404,
        PIN_REQUIRED: 400,
        CONNECT_TIMEOUT: 408,
      }
      const status = statusMap[err.code] ?? 500
      reply.status(status).send(fail(err.code, err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('BLUETOOTH_ERROR', message))
  }
}

export async function handleDisconnect(
  request: FastifyRequest<{ Params: { address: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = btAddressParamSchema.safeParse(request.params)
    if (!parsed.success) {
      reply.status(400).send(fail('INVALID_ADDRESS', 'Invalid BT MAC format'))
      return
    }

    const result = await bluetoothService.disconnectDevice(parsed.data.address)
    reply.status(200).send(ok(result))
  } catch (err) {
    if (err instanceof BluetoothError) {
      reply.status(500).send(fail(err.code, err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('BLUETOOTH_ERROR', message))
  }
}
