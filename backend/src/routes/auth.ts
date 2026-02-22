import type { FastifyInstance } from 'fastify'
import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleRefresh,
  handleMe,
  handleSetupStatus,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'

const authRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/setup-status', handleSetupStatus)
  app.post('/api/auth/register', authRateLimit, handleRegister)
  app.post('/api/auth/login', authRateLimit, handleLogin)
  app.post('/api/auth/refresh', handleRefresh)

  app.post('/api/auth/logout', { preHandler: [requireAuth] }, handleLogout)
  app.get('/api/auth/me', { preHandler: [requireAuth] }, handleMe)
}
