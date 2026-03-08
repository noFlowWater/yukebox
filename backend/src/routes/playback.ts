import type { FastifyInstance } from 'fastify'
import { handleStop, handlePause, handleVolume, handleSeek, handleSkip, handlePrevious } from '../controllers/playback.controller.js'

export default async function playbackRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/stop', handleStop)
  app.post('/api/pause', handlePause)
  app.post('/api/volume', handleVolume)
  app.post('/api/seek', handleSeek)
  app.post('/api/skip', handleSkip)
  app.post('/api/previous', handlePrevious)
}
