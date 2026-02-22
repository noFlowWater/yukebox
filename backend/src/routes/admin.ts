import type { FastifyInstance } from 'fastify'
import { handleGetUsers, handleDeleteUser, handleUpdateRole } from '../controllers/admin.controller.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  app.get('/api/admin/users', handleGetUsers)
  app.delete('/api/admin/users/:id', handleDeleteUser)
  app.patch('/api/admin/users/:id/role', handleUpdateRole)
}
