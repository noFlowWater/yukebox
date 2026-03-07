import type { FastifyInstance } from 'fastify'
import { handleYoutubeDetails, handlePinnedComment } from '../controllers/youtube.controller.js'

export default async function youtubeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/youtube/details', handleYoutubeDetails)
  app.get('/api/youtube/pinned-comment', handlePinnedComment)
}
