// API response wrapper
export interface ApiResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

// Playback
export interface PlayResult {
  title: string
  url: string
  thumbnail: string
  duration: number
}

export interface PlaybackStatus {
  playing: boolean
  paused: boolean
  title: string
  url: string
  duration: number
  position: number
  volume: number
  speaker_id: number | null
  speaker_name: string | null
  has_next: boolean
}

// Speaker status (dashboard)
export interface SpeakerStatus extends PlaybackStatus {
  queue_count: number
}

// Playback mode
export type PlaybackMode = 'sequential' | 'repeat-all' | 'repeat-one' | 'shuffle'

// Queue
export interface QueueItem {
  id: number
  url: string
  title: string
  thumbnail: string
  duration: number
  position: number
  status: 'pending' | 'playing' | 'paused'
  paused_position: number | null
  added_at: string
  speaker_id: number | null
  schedule_id: number | null
}

// Schedule
export interface Schedule {
  id: number
  url: string
  query: string
  title: string
  thumbnail: string
  duration: number
  scheduled_at: string
  status: 'pending' | 'playing' | 'completed' | 'failed'
  group_id: string | null
  created_at: string
  speaker_id: number | null
}

// User
export interface User {
  id: number
  username: string
  role: 'admin' | 'user'
  created_at: string
}

// Search
export interface SearchResult {
  url: string
  title: string
  thumbnail: string
  duration: number
}

// Speaker
export interface Speaker {
  id: number
  sink_name: string
  display_name: string
  is_default: boolean
  default_volume: number | null
  bt_device_id: number | null
  online: boolean
  state: string
  active: boolean
  playing: boolean
  created_at: string
}

export interface AvailableSink {
  sink_name: string
  description: string
  state: string
}

// Bluetooth
export interface BluetoothDevice {
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
  error?: string
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

export interface Settings {
  default_volume: number
  bt_auto_register: boolean
  bt_auto_reconnect: boolean
  bt_monitoring_interval: number
  bt_scan_duration: number
}

// Favorite
export interface Favorite {
  id: number
  user_id: number
  url: string
  title: string
  thumbnail: string
  duration: number
  added_at: string
}
