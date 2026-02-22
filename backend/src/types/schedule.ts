export interface Schedule {
  id: number
  url: string
  query: string
  title: string
  thumbnail: string
  duration: number
  scheduled_at: string
  status: string
  group_id: string | null
  speaker_id: number | null
  created_at: string
}

export interface CreateSchedule {
  url?: string
  query?: string
  title: string
  thumbnail?: string
  duration?: number
  scheduled_at: string
  group_id?: string | null
  speaker_id?: number | null
}
