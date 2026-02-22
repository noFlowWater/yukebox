export interface MpvStatus {
  playing: boolean
  paused: boolean
  title: string
  url: string
  duration: number
  position: number
  volume: number
  speaker_id: number | null
  speaker_name: string | null
}

export const EMPTY_STATUS: MpvStatus = {
  playing: false,
  paused: false,
  title: '',
  url: '',
  duration: 0,
  position: 0,
  volume: 60,
  speaker_id: null,
  speaker_name: null,
}

export interface MpvIpcResponse {
  request_id?: number
  error?: string
  data?: unknown
  event?: string
  reason?: string
}
