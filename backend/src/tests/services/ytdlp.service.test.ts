import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isYouTubeUrl } from '../../services/ytdlp.service.js'

// Mock child_process to avoid real yt-dlp calls
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('node:util', async () => {
  const actual = await vi.importActual<typeof import('node:util')>('node:util')
  return {
    ...actual,
    promisify: vi.fn((fn: unknown) => fn),
  }
})

describe('isYouTubeUrl', () => {
  it('should match standard youtube.com URLs', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true)
    expect(isYouTubeUrl('http://www.youtube.com/watch?v=abc123')).toBe(true)
    expect(isYouTubeUrl('https://youtube.com/watch?v=abc123')).toBe(true)
  })

  it('should match youtu.be short URLs', () => {
    expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true)
    expect(isYouTubeUrl('http://youtu.be/abc123')).toBe(true)
  })

  it('should match youtube.com without protocol', () => {
    expect(isYouTubeUrl('www.youtube.com/watch?v=abc123')).toBe(true)
    expect(isYouTubeUrl('youtube.com/watch?v=abc123')).toBe(true)
  })

  it('should not match non-youtube URLs', () => {
    expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false)
    expect(isYouTubeUrl('https://example.com')).toBe(false)
    expect(isYouTubeUrl('random string')).toBe(false)
  })

  it('should not match empty string', () => {
    expect(isYouTubeUrl('')).toBe(false)
  })
})

describe('resolve', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  function setupPromisify() {
    return import('node:util').then(({ promisify }) => {
      vi.mocked(promisify).mockImplementation((fn: unknown) => {
        return (...fnArgs: unknown[]) => {
          return new Promise((resolve, reject) => {
            (fn as (...args: unknown[]) => void)(...fnArgs, (err: Error | null, result: unknown) => {
              if (err) reject(err)
              else resolve(result)
            })
          })
        }
      })
    })
  }

  it('should parse yt-dlp output correctly', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, {
          stdout: 'https://youtube.com/watch?v=abc\nTest Song\nhttps://img.youtube.com/vi/abc/0.jpg\n240\nhttps://audio-url.example.com/stream\n',
          stderr: '',
        })
      }
      return undefined as never
    })

    await setupPromisify()

    const { resolve } = await import('../../services/ytdlp.service.js')
    const result = await resolve('https://youtube.com/watch?v=abc')

    expect(result.url).toBe('https://youtube.com/watch?v=abc')
    expect(result.title).toBe('Test Song')
    expect(result.thumbnail).toBe('https://img.youtube.com/vi/abc/0.jpg')
    expect(result.duration).toBe(240)
    expect(result.audioUrl).toBe('https://audio-url.example.com/stream')
  })

  it('should throw on truncated output (< 5 lines)', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, {
          stdout: 'https://youtube.com/watch?v=abc\nTest Song\n',
          stderr: '',
        })
      }
      return undefined as never
    })

    await setupPromisify()

    const { resolve } = await import('../../services/ytdlp.service.js')
    await expect(resolve('https://youtube.com/watch?v=abc')).rejects.toThrow('Failed to resolve URL')
  })

  it('should throw on yt-dlp process error', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(new Error('Command failed: yt-dlp exited with code 1'), { stdout: '', stderr: 'ERROR: video not found' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { resolve } = await import('../../services/ytdlp.service.js')
    await expect(resolve('https://youtube.com/watch?v=bad')).rejects.toThrow('Failed to resolve URL')
  })
})

describe('search', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  function setupPromisify() {
    return import('node:util').then(({ promisify }) => {
      vi.mocked(promisify).mockImplementation((fn: unknown) => {
        return (...fnArgs: unknown[]) => {
          return new Promise((resolve, reject) => {
            (fn as (...args: unknown[]) => void)(...fnArgs, (err: Error | null, result: unknown) => {
              if (err) reject(err)
              else resolve(result)
            })
          })
        }
      })
    })
  }

  it('should parse search results correctly', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, {
          stdout: 'https://youtube.com/watch?v=1\tSong 1\thttps://thumb1.jpg\t180\nhttps://youtube.com/watch?v=2\tSong 2\thttps://thumb2.jpg\t240\n',
          stderr: '',
        })
      }
      return undefined as never
    })

    await setupPromisify()

    const { search } = await import('../../services/ytdlp.service.js')
    const results = await search('lofi hip hop', 2)

    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('Song 1')
    expect(results[0].duration).toBe(180)
    expect(results[1].title).toBe('Song 2')
    expect(results[1].url).toBe('https://youtube.com/watch?v=2')
  })

  it('should throw on yt-dlp process error', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(new Error('Command failed: yt-dlp exited with code 1'), { stdout: '', stderr: 'ERROR: search failed' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { search } = await import('../../services/ytdlp.service.js')
    await expect(search('test query', 5)).rejects.toThrow('Search failed')
  })

  it('should return empty array on empty stdout', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, {
          stdout: '',
          stderr: '',
        })
      }
      return undefined as never
    })

    await setupPromisify()

    const { search } = await import('../../services/ytdlp.service.js')
    const results = await search('nonexistent query', 5)

    expect(results).toEqual([])
  })
})
