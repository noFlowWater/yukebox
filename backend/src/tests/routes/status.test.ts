import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import statusRoutes from '../../routes/status.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { EMPTY_STATUS } from '../../types/mpv.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

// Mock mpv service
vi.mock('../../services/mpv.service.js', () => ({
  mpvService: {
    getStatus: vi.fn(),
  },
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  setupAuth(app)
  app.setErrorHandler(errorHandler)
  wrapWithAuth(app, statusRoutes)
  return app
}

describe('GET /api/status', () => {
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
    const response = await app.inject({ method: 'GET', url: '/api/status' })
    expect(response.statusCode).toBe(401)
  })

  it('should return current status', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    vi.mocked(mpvService.getStatus).mockResolvedValueOnce({
      playing: true,
      paused: false,
      title: 'Test Song',
      url: 'https://youtube.com/watch?v=abc',
      duration: 240,
      position: 60,
      volume: 80,
      speaker_id: null,
      speaker_name: null,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/status',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.playing).toBe(true)
    expect(body.data.title).toBe('Test Song')
    expect(body.data.volume).toBe(80)
  })

  it('should return empty status when nothing is playing', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    vi.mocked(mpvService.getStatus).mockResolvedValueOnce({ ...EMPTY_STATUS })

    const response = await app.inject({
      method: 'GET',
      url: '/api/status',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.playing).toBe(false)
    expect(body.data.title).toBe('')
  })

  it('should include speaker_id and speaker_name in status', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    vi.mocked(mpvService.getStatus).mockResolvedValueOnce({
      playing: true,
      paused: false,
      title: 'Speaker Song',
      url: 'https://youtube.com/watch?v=spk',
      duration: 200,
      position: 30,
      volume: 75,
      speaker_id: 1,
      speaker_name: 'Living Room',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/status',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.speaker_id).toBe(1)
    expect(body.data.speaker_name).toBe('Living Room')
  })

  it('should return null speaker fields when no speaker active', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    vi.mocked(mpvService.getStatus).mockResolvedValueOnce({ ...EMPTY_STATUS })

    const response = await app.inject({
      method: 'GET',
      url: '/api/status',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.speaker_id).toBeNull()
    expect(body.data.speaker_name).toBeNull()
  })

  it('should return 500 on mpv error', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    vi.mocked(mpvService.getStatus).mockRejectedValueOnce(new Error('mpv crashed'))

    const response = await app.inject({
      method: 'GET',
      url: '/api/status',
      headers: { cookie: authCookie },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json().error.code).toBe('STATUS_ERROR')
  })
})

describe('GET /api/status/stream', () => {
  it('should return SSE content type and initial data', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    vi.mocked(mpvService.getStatus).mockResolvedValue({
      playing: true,
      paused: false,
      title: 'SSE Song',
      url: 'https://youtube.com/watch?v=sse',
      duration: 300,
      position: 0,
      volume: 100,
      speaker_id: null,
      speaker_name: null,
    })

    const app = buildTestApp()
    const address = await app.listen({ port: 0 })
    const authCookie = await getAuthCookie()
    const controller = new AbortController()

    try {
      const response = await fetch(`${address}/api/status/stream`, {
        signal: controller.signal,
        headers: { cookie: authCookie },
      })

      expect(response.headers.get('content-type')).toBe('text/event-stream')

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      const { value } = await reader.read()
      const text = decoder.decode(value)

      expect(text).toContain('data:')
      expect(text).toContain('SSE Song')
    } finally {
      controller.abort()
      await app.close()
    }
  })
})
