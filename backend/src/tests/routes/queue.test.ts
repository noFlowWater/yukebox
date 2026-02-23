import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import queueRoutes from '../../routes/queue.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { closeDb, getDb } from '../../repositories/db.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

// Mock yt-dlp (external dep)
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

// Use vi.hoisted to make mockEngine available in hoisted vi.mock
const { mockEngine } = vi.hoisted(() => ({
  mockEngine: {
    addToQueue: vi.fn(),
    addToQueueBulk: vi.fn(),
    removeFromQueue: vi.fn(),
    reorderQueue: vi.fn(),
    shuffleQueue: vi.fn(),
    clearQueue: vi.fn(),
    playFromQueue: vi.fn(),
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
      mockEngine.addToQueue.mockResolvedValueOnce({
        id: 1,
        url: 'https://youtube.com/watch?v=abc',
        title: 'Test Song',
        thumbnail: 'https://thumb.jpg',
        duration: 180,
        position: 0,
        status: 'pending',
        paused_position: null,
        speaker_id: 1,
        schedule_id: null,
        added_at: new Date().toISOString(),
      })

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
    })

    it('should add item to queue with query', async () => {
      mockEngine.addToQueue.mockResolvedValueOnce({
        id: 2,
        url: 'https://youtube.com/watch?v=abc',
        title: 'Test Song',
        thumbnail: 'https://thumb.jpg',
        duration: 180,
        position: 1,
        status: 'pending',
        paused_position: null,
        speaker_id: 1,
        schedule_id: null,
        added_at: new Date().toISOString(),
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { query: 'lofi music' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
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

  describe('PATCH /api/queue/:id/position', () => {
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
      mockEngine.addToQueue.mockResolvedValueOnce({
        id: 3,
        url: 'https://youtube.com/watch?v=spk',
        title: 'Test Song',
        thumbnail: 'https://thumb.jpg',
        duration: 180,
        position: 0,
        status: 'pending',
        paused_position: null,
        speaker_id: 1,
        schedule_id: null,
        added_at: new Date().toISOString(),
      })

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
  })

  describe('GET /api/queue (with speaker_id filter)', () => {
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
