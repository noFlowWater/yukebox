export interface Speaker {
  id: number
  sink_name: string
  display_name: string
  is_default: number
  default_volume: number | null
  bt_device_id: number | null
  created_at: string
}

export interface SpeakerPublic {
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

export interface PulseSink {
  name: string
  state: string
}

export interface PulseSinkDetail {
  name: string
  description: string
  deviceString: string
  state: string
}

export interface AvailableSink {
  sink_name: string
  description: string
  state: string
}

export function toPublicSpeaker(speaker: Speaker, online: boolean, state: string, active: boolean = false, playing: boolean = false): SpeakerPublic {
  return {
    id: speaker.id,
    sink_name: speaker.sink_name,
    display_name: speaker.display_name,
    is_default: speaker.is_default === 1,
    default_volume: speaker.default_volume,
    bt_device_id: speaker.bt_device_id,
    online,
    state,
    active,
    playing,
    created_at: speaker.created_at,
  }
}
