import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { speakerAdminRoutes, speakerUserRoutes } from '../../routes/speaker.js'
import { requireAuth, requireUser } from '../../middleware/auth.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { closeDb } from '../../repositories/db.js'
import { getAuthCookie, createTestUserInDb } from '../helpers/auth.js'

// Mock mpv (needed because getDb triggers initSchema which other modules may reference)
vi.mock('../../services/mpv.service.js', () => ({
  mpvService: {
    play: vi.fn(),
    on: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    getActiveSpeakerId: vi.fn().mockReturnValue(null),
    getStatus: vi.fn().mockResolvedValue(null),
    stop: vi.fn(),
    setActiveSpeaker: vi.fn(),
  },
}))

// Mock pulse.service — return controlled data
const mockListSinks = vi.fn()
const mockGetSinkDetails = vi.fn()
const mockInvalidateCache = vi.fn()

vi.mock('../../services/pulse.service.js', () => ({
  listSinks: (...args: unknown[]) => mockListSinks(...args),
  getSinkDetails: (...args: unknown[]) => mockGetSinkDetails(...args),
  invalidateCache: (...args: unknown[]) => mockInvalidateCache(...args),
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.register(cookie)
  app.setErrorHandler(errorHandler)

  // Admin routes (with admin auth)
  app.register(speakerAdminRoutes)

  // User routes (with user auth)
  app.register(async function userScope(instance) {
    instance.addHook('preHandler', requireAuth)
    instance.addHook('preHandler', requireUser)
    instance.register(speakerUserRoutes)
  })

  return app
}

describe('Speaker API', () => {
  let app: ReturnType<typeof buildTestApp>
  let adminCookie: string
  let userCookie: string

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    app = buildTestApp()
    await app.ready()

    const adminId = createTestUserInDb('speakeradmin', 'admin')
    const userId = createTestUserInDb('speakeruser', 'user')

    adminCookie = await getAuthCookie(adminId, 'admin')
    userCookie = await getAuthCookie(userId, 'user')
  })

  afterAll(async () => {
    await app.close()
    closeDb()
    delete process.env.DB_PATH
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: pactl returns two sinks
    mockListSinks.mockResolvedValue([
      { name: 'alsa_output.analog', state: 'RUNNING' },
      { name: 'bluez_sink.bt_speaker', state: 'IDLE' },
    ])
    mockGetSinkDetails.mockResolvedValue({
      name: 'bluez_sink.bt_speaker',
      description: 'BT Speaker',
      deviceString: 'AA:BB:CC:DD:EE:FF',
      state: 'IDLE',
    })
  })

  describe('POST /api/speakers', () => {
    it('should register a speaker as admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: 'alsa_output.analog', display_name: 'Built-in Speaker' },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.sink_name).toBe('alsa_output.analog')
      expect(body.data.display_name).toBe('Built-in Speaker')
      expect(body.data.is_default).toBe(true) // first speaker becomes default
      expect(body.data.online).toBe(true)
      expect(body.data.state).toBe('RUNNING')
    })

    it('should return 409 for duplicate sink', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: 'alsa_output.analog', display_name: 'Duplicate' },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error.code).toBe('DUPLICATE_SINK')
    })

    it('should register a second speaker (non-default)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: 'bluez_sink.bt_speaker', display_name: 'BT Speaker' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().data.is_default).toBe(false) // not the first
    })

    it('should return 400 for sink not found in pactl', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: 'nonexistent_sink', display_name: 'Ghost' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('SINK_NOT_FOUND')
    })

    it('should return 400 for invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: '', display_name: '' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: userCookie },
        payload: { sink_name: 'alsa_output.analog', display_name: 'Test' },
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/speakers', () => {
    it('should return registered speakers for user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/speakers',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.length).toBeGreaterThanOrEqual(2)

      const speaker = body.data.find((s: { sink_name: string }) => s.sink_name === 'alsa_output.analog')
      expect(speaker).toBeDefined()
      expect(speaker.online).toBe(true)
      expect(speaker.state).toBe('RUNNING')
    })

    it('should allow admin access too', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
      })

      // Admin role has user capability
      expect(response.statusCode).toBe(200)
    })

    it('should show offline speakers when pactl fails', async () => {
      mockListSinks.mockRejectedValue(new Error('pactl not found'))

      const response = await app.inject({
        method: 'GET',
        url: '/api/speakers',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      for (const speaker of body.data) {
        expect(speaker.online).toBe(false)
        expect(speaker.state).toBe('UNAVAILABLE')
      }
    })
  })

  describe('DELETE /api/speakers/:id', () => {
    it('should remove a speaker as admin', async () => {
      // Register a disposable speaker
      mockListSinks.mockResolvedValue([
        { name: 'alsa_output.analog', state: 'RUNNING' },
        { name: 'bluez_sink.bt_speaker', state: 'IDLE' },
        { name: 'disposable_sink', state: 'IDLE' },
      ])

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: 'disposable_sink', display_name: 'Disposable' },
      })
      const speakerId = createRes.json().data.id

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/speakers/${speakerId}`,
        headers: { cookie: adminCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.removed).toBe(true)
    })

    it('should return 404 for non-existent speaker', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/speakers/9999',
        headers: { cookie: adminCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/speakers/abc',
        headers: { cookie: adminCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/speakers/1',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should promote next speaker as default when deleting default', async () => {
      // Get current speakers
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/speakers',
        headers: { cookie: userCookie },
      })
      const speakers = listRes.json().data
      const defaultSpeaker = speakers.find((s: { is_default: boolean }) => s.is_default)

      if (defaultSpeaker) {
        const response = await app.inject({
          method: 'DELETE',
          url: `/api/speakers/${defaultSpeaker.id}`,
          headers: { cookie: adminCookie },
        })
        expect(response.statusCode).toBe(200)

        // Check that another speaker is now default
        const newListRes = await app.inject({
          method: 'GET',
          url: '/api/speakers',
          headers: { cookie: userCookie },
        })
        const remaining = newListRes.json().data
        if (remaining.length > 0) {
          const newDefault = remaining.find((s: { is_default: boolean }) => s.is_default)
          expect(newDefault).toBeDefined()
        }
      }
    })
  })

  describe('PATCH /api/speakers/:id/default', () => {
    it('should set speaker as default', async () => {
      // Re-register speakers for this test
      mockListSinks.mockResolvedValue([
        { name: 'new_sink_1', state: 'RUNNING' },
        { name: 'new_sink_2', state: 'IDLE' },
      ])

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: 'new_sink_1', display_name: 'Sink 1' },
      })
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/speakers',
        headers: { cookie: adminCookie },
        payload: { sink_name: 'new_sink_2', display_name: 'Sink 2' },
      })
      const sink2Id = res2.json().data.id

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/speakers/${sink2Id}/default`,
        headers: { cookie: adminCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.is_default).toBe(true)
    })

    it('should return 404 for non-existent speaker', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/speakers/9999/default',
        headers: { cookie: adminCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/speakers/abc/default',
        headers: { cookie: adminCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/speakers/1/default',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('POST /api/speakers/:id/activate', () => {
    it('should activate a speaker as user', async () => {
      // Get speakers list first
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/speakers',
        headers: { cookie: userCookie },
      })
      const speakers = listRes.json().data
      const target = speakers[0]

      const response = await app.inject({
        method: 'POST',
        url: `/api/speakers/${target.id}/activate`,
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.active).toBe(true)
      expect(body.data.playing).toBe(false)
    })

    it('should return 404 for non-existent speaker', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers/9999/activate',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/speakers/abc/activate',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/speakers (active/playing fields)', () => {
    it('should include active and playing fields in response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/speakers',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      for (const speaker of body.data) {
        expect(speaker).toHaveProperty('active')
        expect(speaker).toHaveProperty('playing')
        expect(typeof speaker.active).toBe('boolean')
        expect(typeof speaker.playing).toBe('boolean')
      }
    })
  })

  describe('GET /api/speakers/available', () => {
    it('should return unregistered sinks for admin', async () => {
      // Mock pactl returning 3 sinks, some already registered
      mockListSinks.mockResolvedValue([
        { name: 'new_sink_1', state: 'RUNNING' },
        { name: 'new_sink_2', state: 'IDLE' },
        { name: 'unregistered_sink', state: 'RUNNING' },
      ])
      mockGetSinkDetails.mockResolvedValue({
        name: 'unregistered_sink',
        description: 'New Speaker',
        deviceString: '',
        state: 'RUNNING',
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/speakers/available',
        headers: { cookie: adminCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)

      // Only sinks not already registered should appear
      const sinkNames = body.data.map((s: { sink_name: string }) => s.sink_name)
      // registered: new_sink_1, new_sink_2 (from previous tests); unregistered_sink should be available
      expect(sinkNames).toContain('unregistered_sink')
    })

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/speakers/available',
        headers: { cookie: userCookie },
      })

      expect(response.statusCode).toBe(403)
    })
  })
})
