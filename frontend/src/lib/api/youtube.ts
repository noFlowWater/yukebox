import { request } from './client'
import type { YoutubeDetails, VideoComments, VideoMusic } from '@/types'

export function getYoutubeDetails(url: string) {
  return request<YoutubeDetails>(`/api/youtube/details?url=${encodeURIComponent(url)}`)
}

export function getVideoComments(url: string, signal?: AbortSignal) {
  return request<VideoComments>(`/api/youtube/comments?url=${encodeURIComponent(url)}`, { signal })
}

export function getVideoMusic(url: string, signal?: AbortSignal) {
  return request<VideoMusic>(`/api/youtube/music?url=${encodeURIComponent(url)}`, { signal })
}
