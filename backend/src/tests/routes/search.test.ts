import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import searchRoutes from '../../routes/search.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

// Mock yt-dlp service
vi.mock('../../services/ytdlp.service.js', () => ({
  search: vi.fn(),
  resolve: vi.fn(),
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  setupAuth(app)
  app.setErrorHandler(errorHandler)
  wrapWithAuth(app, searchRoutes)
  return app
}

describe('GET /api/search', () => {
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
      url: '/api/search?query=test',
    })
    expect(response.statusCode).toBe(401)
  })

  it('should return search results', async () => {
    const { search } = await import('../../services/ytdlp.service.js')
    vi.mocked(search).mockResolvedValueOnce([
      { url: 'https://youtube.com/watch?v=1', title: 'Song 1', thumbnail: 'https://t1.jpg', duration: 180 },
      { url: 'https://youtube.com/watch?v=2', title: 'Song 2', thumbnail: 'https://t2.jpg', duration: 240 },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/api/search?query=lofi+hip+hop',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].title).toBe('Song 1')
  })

  it('should respect limit parameter', async () => {
    const { search } = await import('../../services/ytdlp.service.js')
    vi.mocked(search).mockResolvedValueOnce([
      { url: 'https://youtube.com/watch?v=1', title: 'Song 1', thumbnail: '', duration: 180 },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/api/search?query=test&limit=1',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    expect(search).toHaveBeenCalledWith('test', 1)
  })

  it('should return 400 for missing query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/search',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 400 for empty query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/search?query=',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
  })

  it('should return 400 for limit > 20', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/search?query=test&limit=50',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
  })

  it('should return 500 on yt-dlp error', async () => {
    const { search } = await import('../../services/ytdlp.service.js')
    vi.mocked(search).mockRejectedValueOnce(new Error('yt-dlp timeout'))

    const response = await app.inject({
      method: 'GET',
      url: '/api/search?query=test',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json().error.code).toBe('SEARCH_ERROR')
  })

  it('should use default limit of 5', async () => {
    const { search } = await import('../../services/ytdlp.service.js')
    vi.mocked(search).mockResolvedValueOnce([])

    await app.inject({
      method: 'GET',
      url: '/api/search?query=test',
      headers: { cookie: authCookie },
    })

    expect(search).toHaveBeenCalledWith('test', 5)
  })

  it('should return 200 with empty data array when no results found', async () => {
    const { search } = await import('../../services/ytdlp.service.js')
    vi.mocked(search).mockResolvedValueOnce([])

    const response = await app.inject({
      method: 'GET',
      url: '/api/search?query=xyznonexistent',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })
})

describe('POST /api/resolve', () => {
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
      method: 'POST',
      url: '/api/resolve',
      payload: { url: 'https://youtube.com/watch?v=abc' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('should return 200 with resolved track info', async () => {
    const { resolve } = await import('../../services/ytdlp.service.js')
    vi.mocked(resolve).mockResolvedValueOnce({
      url: 'https://youtube.com/watch?v=abc',
      title: 'Test Song',
      thumbnail: 'https://img.youtube.com/vi/abc/0.jpg',
      duration: 240,
      audioUrl: 'https://audio.url/stream',
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/resolve',
      payload: { url: 'https://youtube.com/watch?v=abc' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('Test Song')
    expect(body.data.duration).toBe(240)
  })

  it('should return 400 for invalid URL format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/resolve',
      payload: { url: 'not-a-url' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 400 for missing url field', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/resolve',
      payload: {},
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 500 RESOLVE_ERROR when yt-dlp fails', async () => {
    const { resolve } = await import('../../services/ytdlp.service.js')
    vi.mocked(resolve).mockRejectedValueOnce(new Error('Failed to resolve URL: yt-dlp timeout'))

    const response = await app.inject({
      method: 'POST',
      url: '/api/resolve',
      payload: { url: 'https://youtube.com/watch?v=bad' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('RESOLVE_ERROR')
  })
})
