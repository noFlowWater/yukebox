import type { FastifyInstance } from 'fastify'
import { handleSearch, handleResolve } from '../controllers/search.controller.js'

export default async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/search', handleSearch)
  app.post('/api/resolve', handleResolve)
}
