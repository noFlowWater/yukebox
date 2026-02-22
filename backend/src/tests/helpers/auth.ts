import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import cookie from '@fastify/cookie'
import { getDb } from '../../repositories/db.js'
import { requireAuth, requireUser } from '../../middleware/auth.js'

const TEST_SECRET = new TextEncoder().encode('dev-secret-do-not-use-in-prod')

export async function signTestToken(userId: number, role: string = 'user'): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(TEST_SECRET)
}

export function createTestUserInDb(username: string = 'testuser', role: 'admin' | 'user' = 'user'): number {
  const db = getDb()
  const hash = bcrypt.hashSync('testpass123', 4) // low rounds for speed in tests
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
  ).run(username, hash, role)
  return Number(result.lastInsertRowid)
}

export async function getAuthCookie(userId?: number, role?: string): Promise<string> {
  const token = await signTestToken(userId ?? 1, role ?? 'user')
  return `access_token=${token}`
}

export function setupAuth(app: FastifyInstance): void {
  app.register(cookie)
}

export function wrapWithAuth(
  app: FastifyInstance,
  routePlugin: (app: FastifyInstance) => Promise<void>,
): void {
  app.register(async function protectedScope(instance) {
    instance.addHook('preHandler', requireAuth)
    instance.addHook('preHandler', requireUser)
    instance.register(routePlugin)
  })
}
