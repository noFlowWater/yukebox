import { buildApp } from './app.js'
import { config } from './config/index.js'
import { mpvService } from './services/mpv.service.js'
import { setupAutoAdvance } from './services/queue.service.js'
import { startScheduler, stopScheduler } from './services/schedule.service.js'
import { closeDb } from './repositories/db.js'
import * as speakerRepo from './repositories/speaker.repository.js'
import * as settingsService from './services/settings.service.js'

const app = buildApp()

try {
  const defaultSpeaker = speakerRepo.findDefault()
  if (defaultSpeaker) {
    const volume = defaultSpeaker.default_volume ?? settingsService.getDefaultVolume()
    mpvService.setActiveSpeaker(defaultSpeaker.id, defaultSpeaker.sink_name, defaultSpeaker.display_name, volume)
  }
  setupAutoAdvance()
  startScheduler()
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

async function shutdown() {
  stopScheduler()
  await mpvService.stop()
  closeDb()
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
