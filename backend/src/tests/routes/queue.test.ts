import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import queueRoutes from '../../routes/queue.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { closeDb, getDb } from '../../repositories/db.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

// Mock yt-dlp and mpv (external deps)
vi.mock('../../services/ytdlp.service.js', () => ({
  resolve: vi.fn().mockResolvedValue({
    url: 'https://youtube.com/watch?v=abc',
    title: 'Test Song',
    thumbnail: 'https://thumb.jpg',
    duration: 180,
    audioUrl: 'https://audio.url/stream',
  }),
  search: vi.fn().mockResolvedValue([
    { url: 'https://youtube.com/watch?v=abc', title: 'Test Song', thumbnail: '', duration: 180 },
  ]),
}))

vi.mock('../../services/mpv.service.js', () => ({
  mpvService: {
    play: vi.fn(),
    on: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    getActiveSpeakerId: vi.fn().mockReturnValue(null),
    stop: vi.fn(),
    setActiveSpeaker: vi.fn(),
  },
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  setupAuth(app)
  app.setErrorHandler(errorHandler)
  wrapWithAuth(app, queueRoutes)
  return app
}

describe('Queue API', () => {
  let app: ReturnType<typeof buildTestApp>
  let authCookie: string

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    app = buildTestApp()
    await app.ready()
    authCookie = await getAuthCookie()

    // Register a test speaker for speaker_id FK tests
    const db = getDb()
    db.prepare('INSERT INTO speakers (sink_name, display_name, is_default) VALUES (?, ?, 1)').run('test_sink', 'Test Speaker')
  })

  afterAll(async () => {
    await app.close()
    closeDb()
    delete process.env.DB_PATH
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 without auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/queue' })
    expect(response.statusCode).toBe(401)
  })

  describe('GET /api/queue', () => {
    it('should return empty queue initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/queue',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data).toEqual([])
    })
  })

  describe('POST /api/queue', () => {
    it('should add item to queue with url', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { url: 'https://youtube.com/watch?v=abc' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.title).toBe('Test Song')
      expect(body.data.position).toBe(0)
    })

    it('should add item to queue with query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { query: 'lofi music' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.position).toBe(1)
    })

    it('should return 400 when neither url nor query provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: {},
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/queue (after adding items)', () => {
    it('should return all queued items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/queue',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('PATCH /api/queue/:id/position', () => {
    it('should update item position', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/queue',
        headers: { cookie: authCookie },
      })
      const items = getRes.json().data
      const lastItem = items[items.length - 1]

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/queue/${lastItem.id}/position`,
        payload: { position: 0 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.updated).toBe(true)
    })

    it('should return 404 for non-existent item', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/queue/9999/position',
        payload: { position: 0 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 400 for invalid position', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/queue/1/position',
        payload: { position: -1 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/queue/abc/position',
        payload: { position: 0 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/queue (with speaker_id)', () => {
    it('should accept optional speaker_id in request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { url: 'https://youtube.com/watch?v=spk', speaker_id: 1 },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.speaker_id).toBe(1)
    })

    it('should resolve speaker_id to default speaker when not provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { url: 'https://youtube.com/watch?v=nosp' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      // Resolves to default speaker (id=1) since no speaker_id provided
      expect(body.data.speaker_id).toBe(1)
    })
  })

  describe('GET /api/queue (with speaker_id filter)', () => {
    it('should filter queue by speaker_id query param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/queue?speaker_id=1',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      for (const item of body.data) {
        expect(item.speaker_id).toBe(1)
      }
    })

    it('should return 400 for invalid speaker_id query param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/queue?speaker_id=abc',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('DELETE /api/queue/:id', () => {
    it('should remove item from queue', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/queue',
        headers: { cookie: authCookie },
      })
      const items = getRes.json().data
      const firstItem = items[0]

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/queue/${firstItem.id}`,
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.removed).toBe(true)
    })

    it('should return 404 for non-existent item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/queue/9999',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/queue/abc',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
