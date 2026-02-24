import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import playbackRoutes from '../../routes/playback.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

// Use vi.hoisted to make mockEngine available in hoisted vi.mock
const { mockEngine } = vi.hoisted(() => ({
  mockEngine: {
    stop: vi.fn(),
    togglePause: vi.fn(),
    setVolume: vi.fn(),
    seek: vi.fn(),
    getStatus: vi.fn().mockReturnValue({ playing: false }),
  },
}))

vi.mock('../../services/playback-manager.js', () => ({
  playbackManager: {
    getEngine: vi.fn().mockReturnValue(mockEngine),
    getDefaultEngine: vi.fn().mockReturnValue(mockEngine),
    getOrCreateEngine: vi.fn().mockReturnValue(mockEngine),
  },
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  setupAuth(app)
  app.setErrorHandler(errorHandler)
  wrapWithAuth(app, playbackRoutes)
  return app
}

describe('Playback Control API', () => {
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
    mockEngine.stop.mockResolvedValue(undefined)
    mockEngine.togglePause.mockResolvedValue(undefined)
    mockEngine.setVolume.mockResolvedValue(undefined)
    mockEngine.seek.mockResolvedValue(undefined)
  })

  it('should return 401 without auth', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/stop' })
    expect(response.statusCode).toBe(401)
  })

  describe('POST /api/stop', () => {
    it('should stop playback and return 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/stop',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.stopped).toBe(true)
    })

    it('should return 500 on engine error', async () => {
      mockEngine.stop.mockRejectedValueOnce(new Error('mpv not connected'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/stop',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(500)
      const body = response.json()
      expect(body.error.code).toBe('STOP_ERROR')
    })
  })

  describe('POST /api/pause', () => {
    it('should toggle pause and return 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pause',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.toggled).toBe(true)
    })

    it('should return 500 on engine error', async () => {
      mockEngine.togglePause.mockRejectedValueOnce(new Error('mpv not connected'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/pause',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json().error.code).toBe('PAUSE_ERROR')
    })
  })

  describe('POST /api/volume', () => {
    it('should set volume and return 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/volume',
        payload: { volume: 75 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.volume).toBe(75)
    })

    it('should return 400 for volume > 100', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/volume',
        payload: { volume: 150 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for volume < 0', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/volume',
        payload: { volume: -1 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for non-integer volume', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/volume',
        payload: { volume: 50.5 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing volume', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/volume',
        payload: {},
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 500 on engine error', async () => {
      mockEngine.setVolume.mockRejectedValueOnce(new Error('mpv fail'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/volume',
        payload: { volume: 50 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json().error.code).toBe('VOLUME_ERROR')
    })
  })
})
