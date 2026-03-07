import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('getVideoDetails', () => {
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

  it('should parse dump-json output and return video details', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    const dumpJson = JSON.stringify({
      title: 'Test Video',
      channel: 'Test Channel',
      view_count: 54321,
      upload_date: '20240115',
      description: 'A test description\nWith multiple lines',
      thumbnail: 'https://i.ytimg.com/vi/abc123testt/hqdefault.jpg',
      duration: 180,
      webpage_url: 'https://www.youtube.com/watch?v=abc123testt',
    })

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, { stdout: dumpJson, stderr: '' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoDetails } = await import('../../services/ytdlp.service.js')
    const result = await getVideoDetails('https://youtube.com/watch?v=abc123testt')

    expect(result.title).toBe('Test Video')
    expect(result.channel).toBe('Test Channel')
    expect(result.view_count).toBe(54321)
    expect(result.upload_date).toBe('2024-01-15')
    expect(result.description).toBe('A test description\nWith multiple lines')
    expect(result.thumbnail_hq).toBe('https://i.ytimg.com/vi/abc123testt/maxresdefault.jpg')
    expect(result.duration).toBe(180)
  })

  it('should use uploader when channel is missing', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    const dumpJson = JSON.stringify({
      title: 'Test',
      uploader: 'Uploader Name',
      view_count: 100,
      upload_date: '20230601',
      description: '',
      thumbnail: '',
      duration: 60,
      webpage_url: 'https://www.youtube.com/watch?v=xyz12345678',
    })

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, { stdout: dumpJson, stderr: '' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoDetails } = await import('../../services/ytdlp.service.js')
    const result = await getVideoDetails('https://youtube.com/watch?v=xyz12345678')

    expect(result.channel).toBe('Uploader Name')
  })

  it('should throw on yt-dlp process error', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(new Error('Command failed'), { stdout: '', stderr: 'ERROR' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoDetails } = await import('../../services/ytdlp.service.js')
    await expect(getVideoDetails('https://youtube.com/watch?v=bad')).rejects.toThrow('Failed to get video details')
  })

  it('should throw on invalid JSON output', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, { stdout: 'not json', stderr: '' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoDetails } = await import('../../services/ytdlp.service.js')
    await expect(getVideoDetails('https://youtube.com/watch?v=bad')).rejects.toThrow('Failed to get video details')
  })
})

describe('getVideoComments', () => {
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

  it('should return pinned comment and top comments', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    const dumpJson = JSON.stringify({
      title: 'Test Video',
      comments: [
        { author: 'Creator', text: 'Timestamps:\n0:00 Intro\n1:00 Main', like_count: 500, is_pinned: true },
        { author: 'User1', text: 'Great video!', like_count: 10, is_pinned: false },
        { author: 'User2', text: 'Amazing!', like_count: 5, is_pinned: false },
      ],
    })

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, { stdout: dumpJson, stderr: '' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoComments } = await import('../../services/ytdlp.service.js')
    const result = await getVideoComments('https://youtube.com/watch?v=pinned11111')

    expect(result.pinned).not.toBeNull()
    expect(result.pinned!.author).toBe('Creator')
    expect(result.pinned!.text).toBe('Timestamps:\n0:00 Intro\n1:00 Main')
    expect(result.pinned!.like_count).toBe(500)
    expect(result.top).toHaveLength(2)
    expect(result.top[0].author).toBe('User1')
    expect(result.top[1].author).toBe('User2')
  })

  it('should return null pinned with top comments when no pinned exists', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    const dumpJson = JSON.stringify({
      title: 'Test Video',
      comments: [
        { author: 'User1', text: 'Nice!', like_count: 5, is_pinned: false },
      ],
    })

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, { stdout: dumpJson, stderr: '' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoComments } = await import('../../services/ytdlp.service.js')
    const result = await getVideoComments('https://youtube.com/watch?v=nopin111111')

    expect(result.pinned).toBeNull()
    expect(result.top).toHaveLength(1)
    expect(result.top[0].author).toBe('User1')
  })

  it('should return empty when comments array is undefined', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    const dumpJson = JSON.stringify({ title: 'Test Video' })

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(null, { stdout: dumpJson, stderr: '' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoComments } = await import('../../services/ytdlp.service.js')
    const result = await getVideoComments('https://youtube.com/watch?v=nocomm11111')

    expect(result.pinned).toBeNull()
    expect(result.top).toHaveLength(0)
  })

  it('should throw on yt-dlp process error', async () => {
    const { execFile } = await import('node:child_process')
    const mockExecFile = vi.mocked(execFile)

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
      if (typeof callback === 'function') {
        callback(new Error('Command failed'), { stdout: '', stderr: 'ERROR' })
      }
      return undefined as never
    })

    await setupPromisify()

    const { getVideoComments } = await import('../../services/ytdlp.service.js')
    await expect(getVideoComments('https://youtube.com/watch?v=bad')).rejects.toThrow('Failed to get video comments')
  })
})
