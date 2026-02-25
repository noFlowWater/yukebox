import type { FastifyInstance } from 'fastify'
import { handleStatus, handleStatusAll, handleStatusStream } from '../controllers/status.controller.js'

export default async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/status', handleStatus)
  app.get('/api/status/all', handleStatusAll)
  app.get('/api/status/stream', handleStatusStream)
}
