import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { config } from './config/index.js'
import { errorHandler } from './middleware/error-handler.js'
import { requireAuth, requireUser } from './middleware/auth.js'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cookie)

  app.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  })

  // Rate limit plugin (global: false — only applied via route config)
  app.register(rateLimit, { global: false })

  app.setErrorHandler(errorHandler)

  // Auth routes (public, login/register rate-limited per route)
  app.register(import('./routes/auth.js'))

  // Admin routes (requireAuth + requireAdmin inside the route plugin)
  app.register(import('./routes/admin.js'))

  // Speaker admin routes (requireAuth + requireAdmin inside the route plugin)
  app.register(async (instance) => {
    const { speakerAdminRoutes } = await import('./routes/speaker.js')
    instance.register(speakerAdminRoutes)
  })

  // Settings admin routes (requireAuth + requireAdmin inside the route plugin)
  app.register(async (instance) => {
    const { settingsAdminRoutes } = await import('./routes/settings.js')
    instance.register(settingsAdminRoutes)
  })

  // Bluetooth admin routes (requireAuth + requireAdmin inside the route plugin)
  app.register(async (instance) => {
    const { bluetoothRoutes } = await import('./routes/bluetooth.js')
    instance.register(bluetoothRoutes)
  })

  // User routes: requireAuth + requireUser (playback features)
  app.register(async function userRoutes(instance) {
    instance.addHook('preHandler', requireAuth)
    instance.addHook('preHandler', requireUser)
    instance.register(import('./routes/play.js'))
    instance.register(import('./routes/playback.js'))
    instance.register(import('./routes/status.js'))
    instance.register(import('./routes/queue.js'))
    instance.register(import('./routes/schedule.js'))
    instance.register(import('./routes/search.js'))
    instance.register(import('./routes/favorite.js'))
    const { speakerUserRoutes } = await import('./routes/speaker.js')
    instance.register(speakerUserRoutes)
    const { settingsUserRoutes } = await import('./routes/settings.js')
    instance.register(settingsUserRoutes)
  })

  return app
}
