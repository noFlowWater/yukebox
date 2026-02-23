import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import authRoutes from '../../routes/auth.js'
import { errorHandler } from '../../middleware/error-handler.js'
import { closeDb } from '../../repositories/db.js'

// Mock playback-manager (not needed for auth but prevents import issues)
vi.mock('../../services/playback-manager.js', () => ({
  playbackManager: {
    getEngine: vi.fn().mockReturnValue(null),
    getDefaultEngine: vi.fn().mockReturnValue(null),
    getOrCreateEngine: vi.fn().mockReturnValue(null),
  },
}))

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.register(cookie)
  app.setErrorHandler(errorHandler)
  app.register(authRoutes)
  return app
}

describe('Auth API', () => {
  let app: ReturnType<typeof buildTestApp>

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    app = buildTestApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    closeDb()
    delete process.env.DB_PATH
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/auth/setup-status', () => {
    it('should return hasUsers false when no users exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/setup-status',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.hasUsers).toBe(false)
    })
  })

  describe('POST /api/auth/register', () => {
    it('should register the first user as admin by default', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'admin1', password: 'password123' },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.username).toBe('admin1')
      expect(body.data.role).toBe('admin')
      expect(body.data).not.toHaveProperty('password_hash')
    })

    it('should return hasUsers true after first registration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/setup-status',
      })

      expect(response.json().data.hasUsers).toBe(true)
    })

    it('should register the second user as user (ignoring role param)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'user1', password: 'password123', role: 'admin' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().data.role).toBe('user')
    })

    it('should normalize username to lowercase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'TestUser', password: 'password123' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().data.username).toBe('testuser')
    })

    it('should return 409 for duplicate username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'admin1', password: 'password123' },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error.code).toBe('USERNAME_TAKEN')
    })

    it('should return 400 for username too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'ab', password: 'password123' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for username with invalid characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'user@name', password: 'password123' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for password too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'newuser', password: '1234567' },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and set cookies', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin1', password: 'password123' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.username).toBe('admin1')

      const cookies = response.cookies
      const accessCookie = cookies.find((c: { name: string }) => c.name === 'access_token')
      const refreshCookie = cookies.find((c: { name: string }) => c.name === 'refresh_token')
      expect(accessCookie).toBeDefined()
      expect(refreshCookie).toBeDefined()
      expect(accessCookie!.httpOnly).toBe(true)
      expect(refreshCookie!.httpOnly).toBe(true)
    })

    it('should return 401 for wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin1', password: 'wrongpassword' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json().error.code).toBe('INVALID_CREDENTIALS')
    })

    it('should return 401 for non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nosuchuser', password: 'password123' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json().error.code).toBe('INVALID_CREDENTIALS')
    })

    it('should return generic error for both username and password failures', async () => {
      const wrongUser = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nosuchuser', password: 'password123' },
      })
      const wrongPass = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin1', password: 'wrongpassword' },
      })

      expect(wrongUser.json().error.message).toBe(wrongPass.json().error.message)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin1', password: 'password123' },
      })
      const accessCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'access_token')

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: `access_token=${accessCookie!.value}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.username).toBe('admin1')
      expect(body.data.role).toBe('admin')
    })

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens and rotate refresh token', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'user1', password: 'password123' },
      })
      const refreshCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'refresh_token')

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      })

      expect(response.statusCode).toBe(200)
      const newCookies = response.cookies
      expect(newCookies.find((c: { name: string }) => c.name === 'access_token')).toBeDefined()
      expect(newCookies.find((c: { name: string }) => c.name === 'refresh_token')).toBeDefined()

      // Old refresh token should no longer work (rotation)
      const retryRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      })
      expect(retryRes.statusCode).toBe(401)
    })

    it('should return 401 without refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should clear cookies and revoke token', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin1', password: 'password123' },
      })
      const accessCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'access_token')
      const refreshCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'refresh_token')

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          cookie: `access_token=${accessCookie!.value}; refresh_token=${refreshCookie!.value}`,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.loggedOut).toBe(true)

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      })
      expect(refreshRes.statusCode).toBe(401)
    })
  })
})
