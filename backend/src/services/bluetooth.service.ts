import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import * as btRepo from '../repositories/bluetooth.repository.js'
import * as speakerRepo from '../repositories/speaker.repository.js'
import * as pulseService from './pulse.service.js'
import * as settingsService from './settings.service.js'
import { playbackManager } from './playback-manager.js'
import type { AdapterStatus, ScanDevice, ConnectResult } from '../types/bluetooth.js'

const execFileAsync = promisify(execFile)

export class BluetoothError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'BluetoothError'
  }
}

const AUDIO_SINK_UUID = '0000110b'

let scanProcess: ChildProcess | null = null
const intentionalDisconnects = new Set<string>()

export function macToUnderscore(mac: string): string {
  return mac.replace(/:/g, '_')
}

export function underscoreToMac(underscored: string): string {
  return underscored.replace(/_/g, ':')
}

async function runBtctl(args: string[], timeout = 10_000): Promise<string> {
  try {
    const { stdout } = await execFileAsync('bluetoothctl', args, { timeout })
    return stdout
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new BluetoothError('BLUETOOTH_ERROR', `bluetoothctl ${args.join(' ')} failed: ${message}`)
  }
}

export async function getAdapterStatus(): Promise<AdapterStatus & { error?: string }> {
  try {
    const output = await runBtctl(['show'])
    const powered = /Powered:\s*yes/i.test(output)
    const adapterMatch = output.match(/Controller\s+([0-9A-Fa-f:]+)/)

    if (!adapterMatch) {
      return { available: false, powered: false, adapter: '' }
    }

    if (!powered) {
      try {
        await runBtctl(['power', 'on'])
        return { available: true, powered: true, adapter: 'hci0' }
      } catch {
        return { available: true, powered: false, adapter: 'hci0' }
      }
    }

    return { available: true, powered, adapter: 'hci0' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { available: false, powered: false, adapter: '', error: message }
  }
}

async function getDeviceInfo(address: string): Promise<{ paired: boolean; connected: boolean; name: string; hasAudioSink: boolean }> {
  try {
    const output = await runBtctl(['info', address])
    const paired = /Paired:\s*yes/i.test(output)
    const connected = /Connected:\s*yes/i.test(output)
    const nameMatch = output.match(/Name:\s*(.+)/i)
    const name = nameMatch?.[1]?.trim() ?? address
    const hasAudioSink = output.toLowerCase().includes(AUDIO_SINK_UUID)
    return { paired, connected, name, hasAudioSink }
  } catch {
    return { paired: false, connected: false, name: address, hasAudioSink: false }
  }
}

export async function getPairedDevices(): Promise<void> {
  try {
    let output: string
    try {
      output = await runBtctl(['paired-devices'])
    } catch {
      // bluez < 5.71: 'paired-devices' doesn't exist, use 'devices Paired'
      output = await runBtctl(['devices', 'Paired'])
    }
    const lines = output.trim().split('\n').filter((l) => l.startsWith('Device '))

    for (const line of lines) {
      const match = line.match(/Device\s+([0-9A-Fa-f:]+)\s+(.*)/)
      if (!match) continue

      const [, address, name] = match
      const info = await getDeviceInfo(address)
      if (!info.hasAudioSink) continue

      const device = btRepo.upsert(address, name || info.name)
      btRepo.updateConnectionStatus(address, info.connected)

      if (info.connected) {
        try {
          pulseService.invalidateCache()
          const sinks = await pulseService.listSinks()
          const macUnder = macToUnderscore(address)
          const matchingSink = sinks.find((s) => s.name.includes(`bluez_sink.${macUnder}`))
          if (matchingSink) {
            btRepo.updateSinkName(address, matchingSink.name)
          }
        } catch {
          // sink detection failure is non-critical during sync
        }
      }
    }
  } catch (err) {
    if (err instanceof BluetoothError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new BluetoothError('BLUETOOTH_ERROR', `Failed to get paired devices: ${message}`)
  }
}

export function scanDevices(
  duration: number,
  onDevice: (device: ScanDevice) => void,
  onDone: (scanned: number) => void,
): void {
  if (scanProcess) {
    throw new BluetoothError('SCAN_IN_PROGRESS', 'A scan is already in progress')
  }

  const discovered = new Set<string>()
  let deviceCount = 0
  const proc = spawn('bluetoothctl', [], { stdio: ['pipe', 'pipe', 'pipe'] })
  scanProcess = proc

  proc.stdout?.on('data', async (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      const match = line.match(/\[(?:NEW|CHG)\]\s+Device\s+([0-9A-Fa-f:]+)\s+(.*)/)
      if (!match) continue

      const [, address, name] = match
      if (discovered.has(address)) continue
      discovered.add(address)

      try {
        const info = await getDeviceInfo(address)
        if (!info.hasAudioSink) continue

        deviceCount++
        onDevice({
          address,
          name: name || info.name,
          paired: info.paired,
          connected: info.connected,
        })
      } catch {
        // skip device on info failure
      }
    }
  })

  proc.stdin?.write('scan on\n')

  const timer = setTimeout(() => {
    try {
      proc.stdin?.write('scan off\n')
      setTimeout(() => {
        proc.kill()
        scanProcess = null
        onDone(deviceCount)
      }, 1000)
    } catch {
      scanProcess = null
      onDone(deviceCount)
    }
  }, duration * 1000)

  proc.on('close', () => {
    clearTimeout(timer)
    scanProcess = null
  })

  proc.on('error', () => {
    clearTimeout(timer)
    scanProcess = null
    onDone(deviceCount)
  })
}

export function stopScan(): void {
  if (scanProcess) {
    try {
      scanProcess.stdin?.write('scan off\n')
      scanProcess.kill()
    } catch {
      // already dead
    }
    scanProcess = null
  }
}

export async function connectDevice(address: string): Promise<ConnectResult> {
  try {
    const info = await getDeviceInfo(address)

    if (info.connected) {
      const device = btRepo.upsert(address, info.name)
      pulseService.invalidateCache()
      const sinkName = await waitForSink(address)
      if (sinkName) {
        btRepo.updateSinkName(address, sinkName)
      }
      btRepo.updateConnectionStatus(address, true)

      const existingSpeaker = speakerRepo.findByBtDeviceId(device.id)
      intentionalDisconnects.delete(address)

      return {
        address,
        name: info.name,
        paired: true,
        connected: true,
        sink_name: sinkName,
        auto_registered: false,
        speaker_id: existingSpeaker?.id ?? null,
      }
    }

    if (!info.paired) {
      const pairOutput = await runBtctl(['pair', address], 15_000)
      if (/enter passkey|enter pin/i.test(pairOutput)) {
        throw new BluetoothError('PIN_REQUIRED', 'This device requires PIN pairing. Please pair manually on the host.')
      }
      await runBtctl(['trust', address])
    }

    await runBtctl(['connect', address], 15_000)

    const device = btRepo.upsert(address, info.name)
    btRepo.updateConnectionStatus(address, true)

    pulseService.invalidateCache()
    const sinkName = await waitForSink(address)
    if (sinkName) {
      btRepo.updateSinkName(address, sinkName)
    }

    let autoRegistered = false
    let speakerId: number | null = null

    const existingSpeaker = speakerRepo.findByBtDeviceId(device.id)
    if (existingSpeaker) {
      speakerId = existingSpeaker.id
    } else if (settingsService.getBtAutoRegister() && sinkName) {
      const displayName = info.name || address
      const speaker = speakerRepo.insertWithBtDevice(sinkName, displayName, device.id)

      if (speakerRepo.count() === 1) {
        speakerRepo.setDefault(speaker.id)
      }

      playbackManager.getOrCreateEngine(speaker.id)
      autoRegistered = true
      speakerId = speaker.id
    }

    intentionalDisconnects.delete(address)

    return {
      address,
      name: info.name,
      paired: true,
      connected: true,
      sink_name: sinkName,
      auto_registered: autoRegistered,
      speaker_id: speakerId,
    }
  } catch (err) {
    if (err instanceof BluetoothError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('timed out') || message.includes('Timeout')) {
      throw new BluetoothError('CONNECT_TIMEOUT', `Connection timed out for ${address}`)
    }

    throw new BluetoothError('BLUETOOTH_ERROR', `Failed to connect ${address}: ${message}`)
  }
}

export async function disconnectDevice(address: string): Promise<{ address: string; disconnected: boolean }> {
  try {
    const device = btRepo.findByAddress(address)
    if (device) {
      const speaker = speakerRepo.findByBtDeviceId(device.id)
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
    }

    try {
      await runBtctl(['disconnect', address])
    } catch {
      // may already be disconnected — idempotent
    }

    btRepo.updateConnectionStatus(address, false)
    intentionalDisconnects.add(address)

    return { address, disconnected: true }
  } catch (err) {
    if (err instanceof BluetoothError) throw err
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new BluetoothError('BLUETOOTH_ERROR', `Failed to disconnect ${address}: ${message}`)
  }
}

export function isIntentionalDisconnect(address: string): boolean {
  return intentionalDisconnects.has(address)
}

export function clearIntentionalDisconnect(address: string): void {
  intentionalDisconnects.delete(address)
}

async function waitForSink(address: string, maxWaitMs = 10_000): Promise<string | null> {
  const macUnder = macToUnderscore(address)
  const pattern = `bluez_sink.${macUnder}`
  const interval = 1000
  const maxAttempts = Math.floor(maxWaitMs / interval)

  for (let i = 0; i < maxAttempts; i++) {
    try {
      pulseService.invalidateCache()
      const sinks = await pulseService.listSinks()
      const matching = sinks.find((s) => s.name.includes(pattern))
      if (matching) return matching.name
    } catch {
      // sink listing failed, retry
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  return null
}
