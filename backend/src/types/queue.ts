export interface QueueItem {
  id: number
  url: string
  title: string
  thumbnail: string
  duration: number
  position: number
  status: 'pending' | 'playing' | 'paused'
  paused_position: number | null
  speaker_id: number | null
  added_at: string
}

export interface CreateQueueItem {
  url: string
  title: string
  thumbnail: string
  duration: number
  speaker_id?: number | null
}
