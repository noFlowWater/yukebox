import { request } from './client'
import type { YoutubeDetails, PinnedComment } from '@/types'

export function getYoutubeDetails(url: string) {
  return request<YoutubeDetails>(`/api/youtube/details?url=${encodeURIComponent(url)}`)
}

export function getPinnedComment(url: string, signal?: AbortSignal) {
  return request<PinnedComment | null>(`/api/youtube/pinned-comment?url=${encodeURIComponent(url)}`, { signal })
}
