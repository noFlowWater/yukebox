import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { TrackInfo, SearchResult } from '../types/ytdlp.js'

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
