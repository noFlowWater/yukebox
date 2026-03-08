import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { TrackInfo, SearchResult, VideoDetails, VideoComment, VideoComments } from '../types/ytdlp.js'

const execFileAsync = promisify(execFile)

const YT_URL_PATTERN = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//
const YT_VIDEO_ID_PATTERN = /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

function buildThumbnailUrl(url: string, rawThumbnail: string): string {
  if (rawThumbnail && rawThumbnail !== 'NA') return rawThumbnail
  const match = url.match(YT_VIDEO_ID_PATTERN)
  if (match) return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`
  return ''
}

export function isYouTubeUrl(input: string): boolean {
  return YT_URL_PATTERN.test(input)
}

export async function resolve(url: string): Promise<TrackInfo> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--no-playlist',
      '--print', '%(webpage_url)s\n%(title)s\n%(thumbnail)s\n%(duration)s',
      '-f', 'bestaudio/best',
      '--get-url',
      url,
    ], { timeout: 15000 })

    const lines = stdout.trim().split('\n')

    // --print outputs 4 lines, --get-url outputs 1 line = 5 total
    if (lines.length < 5) {
      throw new Error('Unexpected yt-dlp output format')
    }

    return {
      url: lines[0],
      title: lines[1],
      thumbnail: buildThumbnailUrl(lines[0], lines[2]),
      duration: parseInt(lines[3], 10) || 0,
      audioUrl: lines[4],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to resolve URL: ${message}`)
  }
}

// In-memory cache for video details (TTL: 10 minutes, max 200 entries)
const detailsCache = new Map<string, { data: VideoDetails; expires: number }>()
const DETAILS_CACHE_TTL = 10 * 60 * 1000
const DETAILS_CACHE_MAX = 200

function getCachedDetails(url: string): VideoDetails | null {
  const entry = detailsCache.get(url)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    detailsCache.delete(url)
    return null
  }
  return entry.data
}

function setCachedDetails(url: string, data: VideoDetails): void {
  if (detailsCache.size >= DETAILS_CACHE_MAX) {
    const oldest = detailsCache.keys().next().value
    if (oldest !== undefined) detailsCache.delete(oldest)
  }
  detailsCache.set(url, { data, expires: Date.now() + DETAILS_CACHE_TTL })
}

export async function getVideoDetails(url: string): Promise<VideoDetails> {
  const cached = getCachedDetails(url)
  if (cached) return cached

  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      '-f', 'bestaudio/best',
      url,
    ], { timeout: 15000 })

    const raw = JSON.parse(stdout.trim())

    const uploadDate = raw.upload_date
      ? `${raw.upload_date.slice(0, 4)}-${raw.upload_date.slice(4, 6)}-${raw.upload_date.slice(6, 8)}`
      : ''

    const webpageUrl: string = raw.webpage_url || url
    const idMatch = webpageUrl.match(YT_VIDEO_ID_PATTERN)
    const thumbnailHq = idMatch
      ? `https://i.ytimg.com/vi/${idMatch[1]}/maxresdefault.jpg`
      : raw.thumbnail || ''

    const details: VideoDetails = {
      title: raw.title || '',
      channel: raw.channel || raw.uploader || '',
      view_count: raw.view_count ?? 0,
      upload_date: uploadDate,
      description: raw.description || '',
      thumbnail_hq: thumbnailHq,
      duration: raw.duration ?? 0,
    }

    setCachedDetails(url, details)
    return details
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to get video details: ${message}`)
  }
}

// In-memory cache for video comments (TTL: 10 minutes, max 200 entries)
const commentsCache = new Map<string, { data: VideoComments; expires: number }>()
const COMMENTS_CACHE_TTL = 10 * 60 * 1000
const COMMENTS_CACHE_MAX = 200

function getCachedComments(url: string): VideoComments | null {
  const entry = commentsCache.get(url)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    commentsCache.delete(url)
    return null
  }
  return entry.data
}

function setCachedComments(url: string, data: VideoComments): void {
  if (commentsCache.size >= COMMENTS_CACHE_MAX) {
    const oldest = commentsCache.keys().next().value
    if (oldest !== undefined) commentsCache.delete(oldest)
  }
  commentsCache.set(url, { data, expires: Date.now() + COMMENTS_CACHE_TTL })
}

function toVideoComment(c: { author?: string; text?: string; like_count?: number }): VideoComment {
  return { author: c.author || '', text: c.text || '', like_count: c.like_count ?? 0 }
}

export async function getVideoComments(url: string): Promise<VideoComments> {
  const cached = getCachedComments(url)
  if (cached) return cached

  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      '--no-write-info-json',
      '--write-comments',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:comment_sort=top;max_comments=50,15,0,0',
      url,
    ], { timeout: 20000 })

    const raw = JSON.parse(stdout.trim())

    const empty: VideoComments = { pinned: null, top: [] }

    if (!raw.comments || !Array.isArray(raw.comments) || raw.comments.length === 0) {
      setCachedComments(url, empty)
      return empty
    }

    const rootComments = raw.comments.filter((c: { parent?: string }) => c.parent === 'root')
    const pinned = rootComments.find((c: { is_pinned?: boolean }) => c.is_pinned === true)
    const top = rootComments
      .filter((c: { is_pinned?: boolean }) => c.is_pinned !== true)
      .map(toVideoComment)

    const result: VideoComments = {
      pinned: pinned ? toVideoComment(pinned) : null,
      top,
    }

    setCachedComments(url, result)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to get video comments: ${message}`)
  }
}

export async function search(query: string, limit = 5): Promise<SearchResult[]> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      `ytsearch${limit}:${query}`,
      '--no-download',
      '--flat-playlist',
      '--print', '%(url)s\t%(title)s\t%(thumbnail)s\t%(duration)s',
    ], { timeout: 15000 })

    const lines = stdout.trim().split('\n').filter(Boolean)

    return lines.map((line) => {
      const [url, title, thumbnail, duration] = line.split('\t')
      return {
        url: url || '',
        title: title || '',
        thumbnail: buildThumbnailUrl(url || '', thumbnail || ''),
        duration: parseInt(duration, 10) || 0,
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Search failed: ${message}`)
  }
}
