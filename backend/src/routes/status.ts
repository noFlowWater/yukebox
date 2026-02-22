import type { FastifyInstance } from 'fastify'
import { handleStatus, handleStatusStream } from '../controllers/status.controller.js'

export default async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/status', handleStatus)
  app.get('/api/status/stream', handleStatusStream)
}
