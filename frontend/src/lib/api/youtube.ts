import { request } from './client'
import type { YoutubeDetails } from '@/types'

export function getYoutubeDetails(url: string) {
  return request<YoutubeDetails>(`/api/youtube/details?url=${encodeURIComponent(url)}`)
}
