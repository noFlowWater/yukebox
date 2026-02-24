import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import playRoutes from '../../routes/play.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

// Mock the play service
vi.mock('../../services/play.service.js', () => ({
  play: vi.fn(),
}))

// Mock playback-manager (imported by play.service)
vi.mock('../../services/playback-manager.js', () => ({
  playbackManager: {
    getEngine: vi.fn().mockReturnValue(null),
    getDefaultEngine: vi.fn().mockReturnValue(null),
    getOrCreateEngine: vi.fn().mockReturnValue(null),
  },
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  setupAuth(app)
  app.setErrorHandler(errorHandler)
  wrapWithAuth(app, playRoutes)
  return app
}

describe('POST /api/play', () => {
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

  it('should return 401 without auth cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { url: 'https://youtube.com/watch?v=abc' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('should return 400 when no url or query provided', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: {},
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 400 for invalid url', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { url: 'not-a-url' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.success).toBe(false)
  })

  it('should return 400 for empty query', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { query: '' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(400)
  })

  it('should call play service with url and return 200', async () => {
    const { play } = await import('../../services/play.service.js')
    vi.mocked(play).mockResolvedValueOnce({
      title: 'Test Song',
      url: 'https://youtube.com/watch?v=abc',
      thumbnail: 'https://img.youtube.com/vi/abc/0.jpg',
      duration: 240,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { url: 'https://youtube.com/watch?v=abc' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('Test Song')
    expect(body.data.duration).toBe(240)
  })

  it('should call play service with query and return 200', async () => {
    const { play } = await import('../../services/play.service.js')
    vi.mocked(play).mockResolvedValueOnce({
      title: 'Lofi Song',
      url: 'https://youtube.com/watch?v=xyz',
      thumbnail: 'https://img.youtube.com/vi/xyz/0.jpg',
      duration: 180,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { query: 'lofi hip hop' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('Lofi Song')
  })

  it('should return 500 when play service throws', async () => {
    const { play } = await import('../../services/play.service.js')
    vi.mocked(play).mockRejectedValueOnce(new Error('yt-dlp failed'))

    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { url: 'https://youtube.com/watch?v=bad' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('PLAY_ERROR')
  })

  it('should accept optional speaker_id in request body', async () => {
    const { play } = await import('../../services/play.service.js')
    vi.mocked(play).mockResolvedValueOnce({
      title: 'Speaker Song',
      url: 'https://youtube.com/watch?v=spk',
      thumbnail: 'https://img.youtube.com/vi/spk/0.jpg',
      duration: 200,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { url: 'https://youtube.com/watch?v=spk', speaker_id: 1 },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    expect(vi.mocked(play)).toHaveBeenCalledWith(
      expect.objectContaining({ speaker_id: 1 }),
    )
  })

  it('should work without speaker_id (backward compat)', async () => {
    const { play } = await import('../../services/play.service.js')
    vi.mocked(play).mockResolvedValueOnce({
      title: 'No Speaker Song',
      url: 'https://youtube.com/watch?v=ns',
      thumbnail: 'https://img.youtube.com/vi/ns/0.jpg',
      duration: 150,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/play',
      payload: { query: 'test song' },
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    expect(vi.mocked(play)).toHaveBeenCalledWith(
      expect.not.objectContaining({ speaker_id: expect.any(Number) }),
    )
  })
})
