import type { FastifyInstance } from 'fastify'
import { handleStop, handlePause, handleVolume, handleSeek } from '../controllers/playback.controller.js'

export default async function playbackRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/stop', handleStop)
  app.post('/api/pause', handlePause)
  app.post('/api/volume', handleVolume)
  app.post('/api/seek', handleSeek)
}
