'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'

export function useAdminSettings() {
  const [globalVolume, setGlobalVolume] = useState(60)
  const [globalVolumeSaved, setGlobalVolumeSaved] = useState(60)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const [btAutoRegister, setBtAutoRegister] = useState(true)
  const [btAutoRegisterSaved, setBtAutoRegisterSaved] = useState(true)
  const [btAutoReconnect, setBtAutoReconnect] = useState(true)
  const [btAutoReconnectSaved, setBtAutoReconnectSaved] = useState(true)
  const [btScanDuration, setBtScanDuration] = useState(10)
  const [btScanDurationSaved, setBtScanDurationSaved] = useState(10)
  const [btMonitoringInterval, setBtMonitoringInterval] = useState(15)
  const [btMonitoringIntervalSaved, setBtMonitoringIntervalSaved] = useState(15)

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.getSettings()
      setGlobalVolume(data.default_volume)
      setGlobalVolumeSaved(data.default_volume)
      setBtAutoRegister(data.bt_auto_register)
      setBtAutoRegisterSaved(data.bt_auto_register)
      setBtAutoReconnect(data.bt_auto_reconnect)
      setBtAutoReconnectSaved(data.bt_auto_reconnect)
      setBtScanDuration(data.bt_scan_duration)
      setBtScanDurationSaved(data.bt_scan_duration)
      setBtMonitoringInterval(data.bt_monitoring_interval)
      setBtMonitoringIntervalSaved(data.bt_monitoring_interval)
    } catch (err) {
      handleApiError(err, 'Failed to load settings')
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const settingsDirty =
    globalVolume !== globalVolumeSaved ||
    btAutoRegister !== btAutoRegisterSaved ||
    btAutoReconnect !== btAutoReconnectSaved ||
    btScanDuration !== btScanDurationSaved ||
    btMonitoringInterval !== btMonitoringIntervalSaved

  async function handleSaveSettings() {
    try {
      const body: Record<string, unknown> = {}
      if (globalVolume !== globalVolumeSaved) body.default_volume = globalVolume
      if (btAutoRegister !== btAutoRegisterSaved) body.bt_auto_register = btAutoRegister
      if (btAutoReconnect !== btAutoReconnectSaved) body.bt_auto_reconnect = btAutoReconnect
      if (btScanDuration !== btScanDurationSaved) body.bt_scan_duration = btScanDuration
      if (btMonitoringInterval !== btMonitoringIntervalSaved) body.bt_monitoring_interval = btMonitoringInterval

      await api.updateSettings(body)
      setGlobalVolumeSaved(globalVolume)
      setBtAutoRegisterSaved(btAutoRegister)
      setBtAutoReconnectSaved(btAutoReconnect)
      setBtScanDurationSaved(btScanDuration)
      setBtMonitoringIntervalSaved(btMonitoringInterval)
      toast.success('Settings saved')
    } catch (err) {
      handleApiError(err, 'Failed to save settings')
    }
  }

  return {
    globalVolume, setGlobalVolume,
    globalVolumeSaved,
    settingsLoading,
    btAutoRegister, setBtAutoRegister,
    btAutoReconnect, setBtAutoReconnect,
    btScanDuration, setBtScanDuration,
    btMonitoringInterval, setBtMonitoringInterval,
    settingsDirty,
    fetchSettings,
    handleSaveSettings,
  }
}
