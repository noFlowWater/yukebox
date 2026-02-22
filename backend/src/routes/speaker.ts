import type { FastifyInstance } from 'fastify'
import {
  handleList,
  handleRegister,
  handleRemove,
  handleSetDefault,
  handleAvailableSinks,
  handleActivate,
} from '../controllers/speaker.controller.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

export async function speakerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/speakers', handleList)
  app.post('/api/speakers/:id/activate', handleActivate)
}

export async function speakerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  app.post('/api/speakers', handleRegister)
  app.delete('/api/speakers/:id', handleRemove)
  app.patch('/api/speakers/:id/default', handleSetDefault)
  app.get('/api/speakers/available', handleAvailableSinks)
}
