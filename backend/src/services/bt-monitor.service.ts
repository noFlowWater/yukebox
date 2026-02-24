import * as btRepo from '../repositories/bluetooth.repository.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import * as pulseService from './pulse.service.js'
import * as bluetoothService from './bluetooth.service.js'
import * as settingsService from './settings.service.js'
import { playbackManager } from './playback-manager.js'

const BACKOFF = [5_000, 15_000, 30_000, 60_000]

class BtMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = new Map<string, number>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

  async start(): Promise<void> {
    try {
      await this.startupConnect()
    } catch {
      // startup connect failures are non-blocking
    }

    const intervalMs = settingsService.getBtMonitoringInterval() * 1000
    this.timer = setInterval(() => this.checkDevices(), intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    for (const [, timer] of this.reconnectTimers) {
      clearTimeout(timer)
    }
    this.reconnectTimers.clear()
    this.reconnectAttempts.clear()
  }

  private async startupConnect(): Promise<void> {
    try {
      const devices = btRepo.findAllWithSpeaker()
      const withSpeaker = devices.filter((d) => d.speaker_id !== null)

      for (const device of withSpeaker) {
        try {
          await bluetoothService.connectDevice(device.address)
        } catch {
          // non-blocking — log-level info would go here
        }
      }
    } catch {
      // startup connect failed entirely
    }
  }

  private async checkDevices(): Promise<void> {
    try {
      const devices = btRepo.findAll()
      const connectedDevices = devices.filter((d) => d.is_connected === 1)

      let sinks: { name: string; state: string }[] = []
      try {
        pulseService.invalidateCache()
        sinks = await pulseService.listSinks()
      } catch {
        // pulse unavailable — treat all as disconnected
      }

      for (const device of connectedDevices) {
        const macUnder = bluetoothService.macToUnderscore(device.address)
        const sinkExists = sinks.some((s) => s.name.includes(`bluez_sink.${macUnder}`))

        if (!sinkExists) {
          btRepo.updateConnectionStatus(device.address, false)

          const speaker = device.id ? speakerRepo.findByBtDeviceId(device.id) : null
          if (speaker) {
            const engine = playbackManager.getEngine(speaker.id)
            if (engine) {
              const status = engine.getStatus()
              if (status?.playing) {
                try {
                  await engine.stop()
                } catch {
                  // non-critical
                }
              }
            }
          }

          if (
            settingsService.getBtAutoReconnect() &&
            !bluetoothService.isIntentionalDisconnect(device.address)
          ) {
            this.attemptReconnect(device.address)
          }
        }
      }
    } catch {
      // prevent timer crashes
    }
  }

  private attemptReconnect(address: string): void {
    const attempts = this.reconnectAttempts.get(address) ?? 0
    if (attempts >= BACKOFF.length) {
      this.reconnectAttempts.delete(address)
      this.reconnectTimers.delete(address)
      return
    }

    const delay = BACKOFF[attempts]
    this.reconnectAttempts.set(address, attempts + 1)

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(address)
      try {
        await bluetoothService.connectDevice(address)
        bluetoothService.clearIntentionalDisconnect(address)
        this.reconnectAttempts.delete(address)
      } catch {
        this.attemptReconnect(address)
      }
    }, delay)

    this.reconnectTimers.set(address, timer)
  }
}

export const btMonitor = new BtMonitor()
