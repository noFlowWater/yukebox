import { request } from './client'
import type { AdapterStatus, BluetoothDevice, ConnectResult } from '@/types'

export function getBluetoothStatus() {
  return request<AdapterStatus>('/api/bluetooth/status')
}

export function getBluetoothDevices() {
  return request<BluetoothDevice[]>('/api/bluetooth/devices')
}

export function connectBluetoothDevice(address: string) {
  return request<ConnectResult>(`/api/bluetooth/connect/${encodeURIComponent(address)}`, { method: 'POST' })
}

export function disconnectBluetoothDevice(address: string) {
  return request<{ address: string; disconnected: boolean }>(`/api/bluetooth/disconnect/${encodeURIComponent(address)}`, { method: 'POST' })
}

export function getBluetoothScanStreamUrl(duration?: number) {
  return `/api/bluetooth/scan/stream${duration ? `?duration=${duration}` : ''}`
}
