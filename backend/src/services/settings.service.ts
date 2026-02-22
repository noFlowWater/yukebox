import * as settingsRepo from '../repositories/settings.repository.js'

const DEFAULT_VOLUME_KEY = 'default_volume'
const FALLBACK_VOLUME = 60

export function getDefaultVolume(): number {
  try {
    const value = settingsRepo.get(DEFAULT_VOLUME_KEY)
    if (value === undefined) return FALLBACK_VOLUME
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? FALLBACK_VOLUME : parsed
  } catch {
    return FALLBACK_VOLUME
  }
}

export function setDefaultVolume(volume: number): void {
  try {
    settingsRepo.set(DEFAULT_VOLUME_KEY, String(volume))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to set default volume: ${message}`)
  }
}
