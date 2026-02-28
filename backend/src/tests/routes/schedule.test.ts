import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import scheduleRoutes from '../../routes/schedule.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { closeDb, getDb } from '../../repositories/db.js'
import { setupAuth, wrapWithAuth, getAuthCookie } from '../helpers/auth.js'

// Mock external deps
vi.mock('../../services/ytdlp.service.js', () => ({
  resolve: vi.fn(),
  search: vi.fn(),
}))

// Mock playback-manager
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
  wrapWithAuth(app, scheduleRoutes)
  return app
}

describe('Schedule API', () => {
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
    const response = await app.inject({ method: 'GET', url: '/api/schedules' })
    expect(response.statusCode).toBe(401)
  })

  describe('GET /api/schedules', () => {
    it('should return empty list initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data).toEqual([])
    })
  })

  describe('POST /api/schedules', () => {
    it('should create schedule with url', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=abc',
          title: 'Morning Song',
          scheduled_at: '2026-03-01T07:00:00Z',
        },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.title).toBe('Morning Song')
      expect(body.data.status).toBe('pending')
    })

    it('should create schedule with query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          query: 'relaxing morning music',
          scheduled_at: '2026-03-01T08:00:00Z',
        },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.data.query).toBe('relaxing morning music')
      expect(body.data.title).toBe('relaxing morning music')
    })

    it('should return 400 when neither url nor query provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: { scheduled_at: '2026-03-01T07:00:00Z' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid datetime', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=abc',
          scheduled_at: 'not-a-date',
        },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing scheduled_at', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: { url: 'https://youtube.com/watch?v=abc' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/schedules (with speaker_id)', () => {
    it('should accept optional speaker_id in request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=spk',
          title: 'Speaker Schedule',
          scheduled_at: '2026-04-01T10:00:00Z',
          speaker_id: 1,
        },
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
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=nosp',
          title: 'No Speaker Schedule',
          scheduled_at: '2026-04-01T11:00:00Z',
        },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      // Resolves to default speaker (id=1) since no speaker_id provided
      expect(body.data.speaker_id).toBe(1)
    })
  })

  describe('GET /api/schedules (after creating)', () => {
    it('should return created schedules ordered by time', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.length).toBeGreaterThanOrEqual(2)
      const times = body.data.map((s: { scheduled_at: string }) => s.scheduled_at)
      expect(times).toEqual([...times].sort())
    })
  })

  describe('PATCH /api/schedules/:id/time', () => {
    let pendingScheduleId: number

    it('should create a pending schedule for time-update tests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=time1',
          title: 'Time Update Test',
          duration: 120,
          scheduled_at: '2026-06-01T12:00:00Z',
          speaker_id: 1,
        },
        headers: { cookie: authCookie },
      })
      expect(response.statusCode).toBe(201)
      pendingScheduleId = response.json().data.id
    })

    it('should update scheduled_at for a pending schedule', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/schedules/${pendingScheduleId}/time`,
        payload: { scheduled_at: '2026-06-01T14:00:00Z' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].scheduled_at).toBe('2026-06-01T14:00:00.000Z')
    })

    it('should return 404 for non-existent id', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/schedules/9999/time',
        payload: { scheduled_at: '2026-06-01T14:00:00Z' },
        headers: { cookie: authCookie },
      })
      expect(response.statusCode).toBe(404)
    })

    it('should return 400 for invalid datetime', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/schedules/${pendingScheduleId}/time`,
        payload: { scheduled_at: 'not-a-date' },
        headers: { cookie: authCookie },
      })
      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for past time', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/schedules/${pendingScheduleId}/time`,
        payload: { scheduled_at: '2020-01-01T00:00:00Z' },
        headers: { cookie: authCookie },
      })
      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for non-pending schedule', async () => {
      // Mark as completed
      const db = getDb()
      db.prepare('UPDATE schedules SET status = ? WHERE id = ?').run('completed', pendingScheduleId)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/schedules/${pendingScheduleId}/time`,
        payload: { scheduled_at: '2026-06-01T15:00:00Z' },
        headers: { cookie: authCookie },
      })
      expect(response.statusCode).toBe(400)

      // Restore to pending for subsequent tests
      db.prepare('UPDATE schedules SET status = ? WHERE id = ?').run('pending', pendingScheduleId)
    })

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/schedules/abc/time',
        payload: { scheduled_at: '2026-06-01T15:00:00Z' },
        headers: { cookie: authCookie },
      })
      expect(response.statusCode).toBe(400)
    })

    it('should shift all group items by the same delta', async () => {
      const groupId = 'test-group-time-update'

      // Create 3 grouped schedules
      await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=g1',
          title: 'Group Song 1',
          duration: 180,
          scheduled_at: '2026-07-01T10:00:00Z',
          group_id: groupId,
          speaker_id: 1,
        },
        headers: { cookie: authCookie },
      })
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=g2',
          title: 'Group Song 2',
          duration: 180,
          scheduled_at: '2026-07-01T10:03:00Z',
          group_id: groupId,
          speaker_id: 1,
        },
        headers: { cookie: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=g3',
          title: 'Group Song 3',
          duration: 180,
          scheduled_at: '2026-07-01T10:06:00Z',
          group_id: groupId,
          speaker_id: 1,
        },
        headers: { cookie: authCookie },
      })

      const targetId = res2.json().data.id

      // Shift the second item forward by 2 hours
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/schedules/${targetId}/time`,
        payload: { scheduled_at: '2026-07-01T12:03:00Z' },
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data).toHaveLength(3)

      // All items should have shifted by +2 hours
      const times = body.data.map((s: { scheduled_at: string }) => s.scheduled_at).sort()
      expect(times).toEqual([
        '2026-07-01T12:00:00.000Z',
        '2026-07-01T12:03:00.000Z',
        '2026-07-01T12:06:00.000Z',
      ])
    })

    it('should return 400 when group shift would move items to the past', async () => {
      const groupId = 'test-group-past-check'

      // Create 2 grouped schedules - first one close to "now" in far future
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=gp1',
          title: 'Past Check 1',
          duration: 180,
          scheduled_at: '2026-08-01T10:00:00Z',
          group_id: groupId,
          speaker_id: 1,
        },
        headers: { cookie: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          url: 'https://youtube.com/watch?v=gp2',
          title: 'Past Check 2',
          duration: 180,
          scheduled_at: '2026-08-01T10:30:00Z',
          group_id: groupId,
          speaker_id: 1,
        },
        headers: { cookie: authCookie },
      })

      const firstId = res1.json().data.id

      // Try to shift first item to far past — should fail because other items would also go to past
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/schedules/${firstId}/time`,
        payload: { scheduled_at: '2020-01-01T00:00:00Z' },
        headers: { cookie: authCookie },
      })
      expect(response.statusCode).toBe(400)
    })
  })

  describe('DELETE /api/schedules/:id', () => {
    it('should delete a schedule', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/schedules',
        headers: { cookie: authCookie },
      })
      const schedules = getRes.json().data
      const first = schedules[0]

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedules/${first.id}`,
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.removed).toBe(true)
    })

    it('should return 404 for non-existent schedule', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedules/9999',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedules/abc',
        headers: { cookie: authCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
