import type { FastifyInstance } from 'fastify'
import { handleYoutubeDetails } from '../controllers/youtube.controller.js'

export default async function youtubeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/youtube/details', handleYoutubeDetails)
}
