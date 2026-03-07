export interface TrackInfo {
  url: string
  title: string
  thumbnail: string
  duration: number
  audioUrl: string
}

export interface SearchResult {
  url: string
  title: string
  thumbnail: string
  duration: number
}

export interface VideoDetails {
  title: string
  channel: string
  view_count: number
  upload_date: string
  description: string
  thumbnail_hq: string
  duration: number
}

export interface PinnedComment {
  author: string
  text: string
  like_count: number
}
