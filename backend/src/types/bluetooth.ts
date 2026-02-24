export interface BluetoothDevice {
  id: number
  address: string
  name: string
  alias: string | null
  sink_name: string | null
  is_connected: number
  created_at: string
}

export interface BluetoothDevicePublic {
  id: number
  address: string
  name: string
  alias: string | null
  sink_name: string | null
  is_connected: boolean
  speaker_id: number | null
  speaker_name: string | null
  created_at: string
}

export interface AdapterStatus {
  available: boolean
  powered: boolean
  adapter: string
}

export interface ScanDevice {
  address: string
  name: string
  paired: boolean
  connected: boolean
}

export interface ConnectResult {
  address: string
  name: string
  paired: boolean
  connected: boolean
  sink_name: string | null
  auto_registered: boolean
  speaker_id: number | null
}

export interface DisconnectResult {
  address: string
  disconnected: boolean
}

export function toPublicBluetoothDevice(
  device: BluetoothDevice,
  speakerId: number | null,
  speakerName: string | null,
): BluetoothDevicePublic {
  return {
    id: device.id,
    address: device.address,
    name: device.name,
    alias: device.alias,
    sink_name: device.sink_name,
    is_connected: device.is_connected === 1,
    speaker_id: speakerId,
    speaker_name: speakerName,
    created_at: device.created_at,
  }
}
