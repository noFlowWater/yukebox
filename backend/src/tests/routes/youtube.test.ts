import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import youtubeRoutes from '../../routes/youtube.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

vi.mock('../../services/ytdlp.service.js', () => ({
  getVideoDetails: vi.fn(),
  getVideoComments: vi.fn(),
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  setupAuth(app)
  app.setErrorHandler(errorHandler)
  wrapWithAuth(app, youtubeRoutes)
  return app
}

describe('GET /api/youtube/details', () => {
  let app: ReturnType<typeof buildTestApp>
  let authCookie: string

  beforeAll(async () => {
    app = buildTestApp()
    await app.ready()
    authCookie = await getAuthCookie()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/details?url=https://youtube.com/watch?v=abc',
    })
    expect(response.statusCode).toBe(401)
  })

  it('should return 200 with video details', async () => {
    const { getVideoDetails } = await import('../../services/ytdlp.service.js')
    vi.mocked(getVideoDetails).mockResolvedValueOnce({
      title: 'Test Video',
      channel: 'Test Channel',
      view_count: 12345,
      upload_date: '2024-01-15',
      description: 'Test description',
      thumbnail_hq: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      duration: 300,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/details?url=' + encodeURIComponent('https://youtube.com/watch?v=abc'),
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('Test Video')
    expect(body.data.channel).toBe('Test Channel')
    expect(body.data.view_count).toBe(12345)
    expect(body.data.duration).toBe(300)
  })

  it('should return 400 for missing url', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/details',
      headers: { cookie: authCookie },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 400 for invalid url', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/details?url=not-a-url',
      headers: { cookie: authCookie },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 404 when video not found', async () => {
    const { getVideoDetails } = await import('../../services/ytdlp.service.js')
    vi.mocked(getVideoDetails).mockRejectedValueOnce(new Error('Video unavailable'))

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/details?url=' + encodeURIComponent('https://youtube.com/watch?v=bad'),
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('NOT_FOUND')
  })

  it('should return 500 on generic yt-dlp failure', async () => {
    const { getVideoDetails } = await import('../../services/ytdlp.service.js')
    vi.mocked(getVideoDetails).mockRejectedValueOnce(new Error('Failed to get video details: timeout'))

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/details?url=' + encodeURIComponent('https://youtube.com/watch?v=abc'),
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json().error.code).toBe('YOUTUBE_ERROR')
  })
})

describe('GET /api/youtube/comments', () => {
  let app: ReturnType<typeof buildTestApp>
  let authCookie: string

  beforeAll(async () => {
    app = buildTestApp()
    await app.ready()
    authCookie = await getAuthCookie()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/comments?url=https://youtube.com/watch?v=abc',
    })
    expect(response.statusCode).toBe(401)
  })

  it('should return 200 with pinned and top comments', async () => {
    const { getVideoComments } = await import('../../services/ytdlp.service.js')
    vi.mocked(getVideoComments).mockResolvedValueOnce({
      pinned: { author: 'Creator', text: 'Check timestamps below!', like_count: 100 },
      top: [{ author: 'User1', text: 'Nice!', like_count: 5 }],
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/comments?url=' + encodeURIComponent('https://youtube.com/watch?v=abc'),
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.pinned.author).toBe('Creator')
    expect(body.data.top).toHaveLength(1)
  })

  it('should return 200 with empty comments', async () => {
    const { getVideoComments } = await import('../../services/ytdlp.service.js')
    vi.mocked(getVideoComments).mockResolvedValueOnce({ pinned: null, top: [] })

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/comments?url=' + encodeURIComponent('https://youtube.com/watch?v=abc'),
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.pinned).toBeNull()
    expect(body.data.top).toHaveLength(0)
  })

  it('should return 400 for missing url', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/comments',
      headers: { cookie: authCookie },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 500 on yt-dlp failure', async () => {
    const { getVideoComments } = await import('../../services/ytdlp.service.js')
    vi.mocked(getVideoComments).mockRejectedValueOnce(new Error('Failed to get video comments: timeout'))

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/comments?url=' + encodeURIComponent('https://youtube.com/watch?v=abc'),
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json().error.code).toBe('YOUTUBE_ERROR')
  })
})
