import type { FastifyInstance } from 'fastify'
import { handlePlay } from '../controllers/play.controller.js'

export default async function playRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/play', handlePlay)
}
