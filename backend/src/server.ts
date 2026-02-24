import { buildApp } from './app.js'
import { config } from './config/index.js'
import { playbackManager } from './services/playback-manager.js'
import { btMonitor } from './services/bt-monitor.service.js'
import { closeDb } from './repositories/db.js'

const app = buildApp()

try {
  await playbackManager.init()
  await btMonitor.start()
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

async function shutdown() {
  btMonitor.stop()
  playbackManager.stopScheduleTimer()
  await playbackManager.destroyAll()
  closeDb()
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
