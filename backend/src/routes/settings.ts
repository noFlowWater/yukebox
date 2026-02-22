import type { FastifyInstance } from 'fastify'
import { handleGet, handleUpdate } from '../controllers/settings.controller.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

export async function settingsUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings', handleGet)
}

export async function settingsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  app.patch('/api/settings', handleUpdate)
}
