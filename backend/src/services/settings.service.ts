import * as settingsRepo from '../repositories/settings.repository.js'

const DEFAULT_VOLUME_KEY = 'default_volume'
const FALLBACK_VOLUME = 60

const BT_AUTO_REGISTER_KEY = 'bt_auto_register'
const BT_AUTO_RECONNECT_KEY = 'bt_auto_reconnect'
const BT_MONITORING_INTERVAL_KEY = 'bt_monitoring_interval'
const BT_SCAN_DURATION_KEY = 'bt_scan_duration'

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

export function getBtAutoRegister(): boolean {
  try {
    const value = settingsRepo.get(BT_AUTO_REGISTER_KEY)
    if (value === undefined) return true
    return value === 'true'
  } catch {
    return true
  }
}

export function setBtAutoRegister(enabled: boolean): void {
  try {
    settingsRepo.set(BT_AUTO_REGISTER_KEY, String(enabled))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to set bt_auto_register: ${message}`)
  }
}

export function getBtAutoReconnect(): boolean {
  try {
    const value = settingsRepo.get(BT_AUTO_RECONNECT_KEY)
    if (value === undefined) return true
    return value === 'true'
  } catch {
    return true
  }
}

export function setBtAutoReconnect(enabled: boolean): void {
  try {
    settingsRepo.set(BT_AUTO_RECONNECT_KEY, String(enabled))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to set bt_auto_reconnect: ${message}`)
  }
}

export function getBtMonitoringInterval(): number {
  try {
    const value = settingsRepo.get(BT_MONITORING_INTERVAL_KEY)
    if (value === undefined) return 15
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 5 || parsed > 60) return 15
    return parsed
  } catch {
    return 15
  }
}

export function setBtMonitoringInterval(seconds: number): void {
  try {
    settingsRepo.set(BT_MONITORING_INTERVAL_KEY, String(seconds))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to set bt_monitoring_interval: ${message}`)
  }
}

export function getBtScanDuration(): number {
  try {
    const value = settingsRepo.get(BT_SCAN_DURATION_KEY)
    if (value === undefined) return 10
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 5 || parsed > 30) return 10
    return parsed
  } catch {
    return 10
  }
}

export function setBtScanDuration(seconds: number): void {
  try {
    settingsRepo.set(BT_SCAN_DURATION_KEY, String(seconds))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to set bt_scan_duration: ${message}`)
  }
}
