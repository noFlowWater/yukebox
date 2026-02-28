import type { FastifyInstance } from 'fastify'
import {
  handleGetQueue,
  handleAddToQueue,
  handleBulkAddToQueue,
  handleRemoveFromQueue,
  handleClearPending,
  handleUpdatePosition,
  handlePlayFromQueue,
  handleShuffleQueue,
  handleGetPlaybackMode,
  handleSetPlaybackMode,
} from '../controllers/queue.controller.js'

export default async function queueRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/queue', handleGetQueue)
  app.post('/api/queue', handleAddToQueue)
  app.post('/api/queue/bulk', handleBulkAddToQueue)
  app.delete('/api/queue', handleClearPending)
  app.post('/api/queue/shuffle', handleShuffleQueue)
  app.get('/api/queue/mode', handleGetPlaybackMode)
  app.patch('/api/queue/mode', handleSetPlaybackMode)
  app.post('/api/queue/:id/play', handlePlayFromQueue)
  app.delete('/api/queue/:id', handleRemoveFromQueue)
  app.patch('/api/queue/:id/position', handleUpdatePosition)
}
