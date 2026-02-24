import type { FastifyInstance } from 'fastify'
import {
  handleAdapterStatus,
  handleDevices,
  handleScanStream,
  handleConnect,
  handleDisconnect,
} from '../controllers/bluetooth.controller.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

export async function bluetoothRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  app.get('/api/bluetooth/status', handleAdapterStatus)
  app.get('/api/bluetooth/devices', handleDevices)
  app.get('/api/bluetooth/scan/stream', handleScanStream)
  app.post('/api/bluetooth/connect/:address', handleConnect)
  app.post('/api/bluetooth/disconnect/:address', handleDisconnect)
}
