import type { VideoMusicTrack, VideoMusic } from '../types/ytdlp.js'

const YT_VIDEO_ID_PATTERN = /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const CLIENT_CONTEXT = {
  client: { clientName: 'WEB', clientVersion: '2.20241201.00.00', hl: 'en' },
}

// In-memory cache (TTL: 30 minutes, max 200 entries)
const musicCache = new Map<string, { data: VideoMusic; expires: number }>()
const CACHE_TTL = 30 * 60 * 1000
const CACHE_MAX = 200

function getCached(url: string): VideoMusic | null {
  const entry = musicCache.get(url)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    musicCache.delete(url)
    return null
  }
  return entry.data
}

function setCached(url: string, data: VideoMusic): void {
  if (musicCache.size >= CACHE_MAX) {
    const oldest = musicCache.keys().next().value
    if (oldest !== undefined) musicCache.delete(oldest)
  }
  musicCache.set(url, { data, expires: Date.now() + CACHE_TTL })
}

function extractVideoId(url: string): string | null {
  const match = url.match(YT_VIDEO_ID_PATTERN)
  return match ? match[1] : null
}

interface RawTrackCard {
  title: string
  artist: string
  album: string
  albumThumbnail: string
  videoId: string
}

function discoverTracks(responseData: Record<string, unknown>): RawTrackCard[] {
  const tracks: RawTrackCard[] = []

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const panels = (responseData as any)?.engagementPanels
    if (!Array.isArray(panels)) return tracks

    for (const panel of panels) {
      const content = panel?.engagementPanelSectionListRenderer?.content
      const descRenderer = content?.structuredDescriptionContentRenderer
      if (!descRenderer) continue

      const items = descRenderer?.items
      if (!Array.isArray(items)) continue

      for (const item of items) {
        const cardList = item?.horizontalCardListRenderer
        if (!cardList) continue

        const headerTitle = cardList?.header?.richListHeaderRenderer?.title?.simpleText
        if (headerTitle !== 'Music') continue

        const cards = cardList?.cards
        if (!Array.isArray(cards)) continue

        for (const card of cards) {
          try {
            const vm = card?.videoAttributeViewModel
            if (!vm) continue

            const videoId = vm?.onTap?.innertubeCommand?.watchEndpoint?.videoId
            if (!videoId) continue

            tracks.push({
              title: vm?.title || '',
              artist: vm?.subtitle || '',
              album: vm?.secondarySubtitle?.content || '',
              albumThumbnail: vm?.image?.sources?.[0]?.url || '',
              videoId,
            })
          } catch {
            // skip invalid card
          }
        }
      }
    }
  } catch {
    // graceful degradation
  }

  return tracks
}

async function resolveDuration(videoId: string): Promise<number> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: 'WEB', clientVersion: '2.20241201.00.00' } },
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return 0

    const data = await res.json()
    const seconds = data?.videoDetails?.lengthSeconds
    return seconds ? parseInt(String(seconds), 10) || 0 : 0
  } catch {
    return 0
  }
}

export async function getVideoMusic(url: string): Promise<VideoMusic> {
  const cached = getCached(url)
  if (cached) return cached

  const videoId = extractVideoId(url)
  if (!videoId) {
    return { count: 0, tracks: [] }
  }

  try {
    const nextRes = await fetch('https://www.youtube.com/youtubei/v1/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, context: CLIENT_CONTEXT }),
      signal: AbortSignal.timeout(10000),
    })

    if (!nextRes.ok) {
      const empty = { count: 0, tracks: [] }
      setCached(url, empty)
      return empty
    }

    const nextData = await nextRes.json()
    const rawTracks = discoverTracks(nextData)

    if (rawTracks.length === 0) {
      const empty = { count: 0, tracks: [] }
      setCached(url, empty)
      return empty
    }

    // Resolve durations in parallel
    const durationResults = await Promise.allSettled(
      rawTracks.map((t) => resolveDuration(t.videoId)),
    )

    const tracks: VideoMusicTrack[] = rawTracks.map((raw, i) => {
      const duration =
        durationResults[i].status === 'fulfilled' ? durationResults[i].value : 0

      return {
        url: `https://www.youtube.com/watch?v=${raw.videoId}`,
        title: `${raw.title} - ${raw.artist}`,
        thumbnail: `https://i.ytimg.com/vi/${raw.videoId}/hqdefault.jpg`,
        duration,
        artist: raw.artist,
        album: raw.album,
        albumThumbnail: raw.albumThumbnail,
      }
    })

    const result: VideoMusic = { count: tracks.length, tracks }
    setCached(url, result)
    return result
  } catch {
    const empty = { count: 0, tracks: [] }
    setCached(url, empty)
    return empty
  }
}
