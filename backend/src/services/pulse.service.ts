import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { config } from '../config/index.js'
import type { PulseSink, PulseSinkDetail } from '../types/speaker.js'

const execFileAsync = promisify(execFile)

const CACHE_TTL_MS = 5000
let sinkCache: { data: PulseSink[]; timestamp: number } | null = null

function pactlEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PULSE_SERVER: config.pulseServer }
}

export async function listSinks(): Promise<PulseSink[]> {
  try {
    const now = Date.now()
    if (sinkCache && now - sinkCache.timestamp < CACHE_TTL_MS) {
      return sinkCache.data
    }

    const { stdout } = await execFileAsync('pactl', ['list', 'sinks', 'short'], {
      env: pactlEnv(),
      timeout: 5000,
    })

    const sinks: PulseSink[] = stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split('\t')
        return {
          name: parts[1] ?? '',
          state: (parts[4] ?? 'UNKNOWN').trim(),
        }
      })
      .filter((s) => s.name.length > 0)

    sinkCache = { data: sinks, timestamp: now }
    return sinks
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to list PulseAudio sinks: ${message}`)
  }
}

export async function getSinkDetails(sinkName: string): Promise<PulseSinkDetail | undefined> {
  try {
    const { stdout } = await execFileAsync('pactl', ['list', 'sinks'], {
      env: pactlEnv(),
      timeout: 5000,
    })

    const blocks = stdout.split(/(?=Sink #)/)

    for (const block of blocks) {
      const nameMatch = block.match(/Name:\s*(.+)/)
      if (!nameMatch || nameMatch[1].trim() !== sinkName) continue

      const descMatch = block.match(/Description:\s*(.+)/)
      const deviceMatch = block.match(/device\.string\s*=\s*"([^"]*)"/)
      const stateMatch = block.match(/State:\s*(\w+)/)

      return {
        name: sinkName,
        description: descMatch?.[1]?.trim() ?? sinkName,
        deviceString: deviceMatch?.[1] ?? '',
        state: stateMatch?.[1] ?? 'UNKNOWN',
      }
    }

    return undefined
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to get sink details: ${message}`)
  }
}

export function invalidateCache(): void {
  sinkCache = null
}
