'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'
import type { BluetoothDevice, ScanDevice } from '@/types'

interface UseAdminBluetoothParams {
  onSpeakersChanged: () => Promise<void>
}

export function useAdminBluetooth({ onSpeakersChanged }: UseAdminBluetoothParams) {
  const [btAvailable, setBtAvailable] = useState<boolean | null>(null)
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([])
  const [btScanning, setBtScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanDevice[]>([])
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null)
  const [disconnectingAddress, setDisconnectingAddress] = useState<string | null>(null)
  const [btError, setBtError] = useState<string | null>(null)

  const fetchBluetoothStatus = useCallback(async () => {
    try {
      const status = await api.getBluetoothStatus()
      setBtAvailable(status.available && status.powered)
      setBtError(status.error || null)
    } catch {
      setBtAvailable(false)
      setBtError('Failed to check bluetooth status')
    }
  }, [])

  const fetchBluetoothDevices = useCallback(async () => {
    try {
      const devices = await api.getBluetoothDevices()
      setBtDevices(devices)
    } catch (err) {
      handleApiError(err, 'Failed to load BT devices')
    }
  }, [])

  function handleScan() {
    if (btScanning) return
    setBtScanning(true)
    setScanResults([])

    const es = new EventSource(api.getBluetoothScanStreamUrl())

    es.addEventListener('device', (e) => {
      try {
        const device: ScanDevice = JSON.parse(e.data)
        setScanResults((prev) => {
          if (prev.some((d) => d.address === device.address)) return prev
          return [...prev, device]
        })
      } catch {
        // invalid data
      }
    })

    es.addEventListener('done', () => {
      es.close()
      setBtScanning(false)
      fetchBluetoothDevices()
    })

    es.addEventListener('error', (e) => {
      es.close()
      setBtScanning(false)
      try {
        const evt = e as MessageEvent
        if (evt.data) {
          const err = JSON.parse(evt.data)
          toast.error(err.message || 'Scan failed')
        }
      } catch {
        // SSE connection error
      }
    })

    es.onerror = () => {
      es.close()
      setBtScanning(false)
    }
  }

  async function handleBtConnect(address: string) {
    setConnectingAddress(address)
    try {
      const result = await api.connectBluetoothDevice(address)
      if (result.auto_registered) {
        toast.success(`Connected & registered: ${result.name}`)
      } else {
        toast.success(`Connected: ${result.name}`)
      }
      await fetchBluetoothDevices()
      await onSpeakersChanged()
    } catch (err) {
      handleApiError(err, 'Failed to connect')
    } finally {
      setConnectingAddress(null)
    }
  }

  async function handleBtDisconnect(address: string) {
    setDisconnectingAddress(address)
    try {
      await api.disconnectBluetoothDevice(address)
      toast.success('Disconnected')
      await fetchBluetoothDevices()
      await onSpeakersChanged()
    } catch (err) {
      handleApiError(err, 'Failed to disconnect')
    } finally {
      setDisconnectingAddress(null)
    }
  }

  return {
    btAvailable, btDevices, btScanning, scanResults,
    connectingAddress, disconnectingAddress, btError,
    fetchBluetoothStatus, fetchBluetoothDevices,
    handleScan, handleBtConnect, handleBtDisconnect,
  }
}
