import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken, AuthError } from '../services/auth.service.js'
import { fail } from '../types/api.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: number
    userRole: string
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const token = request.cookies?.access_token
    if (!token) {
      reply.status(401).send(fail('UNAUTHORIZED', 'Authentication required'))
      return
    }

    const { userId, role } = await verifyAccessToken(token)
    request.userId = userId
    request.userRole = role
  } catch (err) {
    if (err instanceof AuthError) {
      reply.status(401).send(fail('UNAUTHORIZED', err.message))
      return
    }
    reply.status(401).send(fail('UNAUTHORIZED', 'Authentication required'))
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.userRole !== 'admin') {
    reply.status(403).send(fail('FORBIDDEN', 'Admin access required'))
  }
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.userRole !== 'user' && request.userRole !== 'admin') {
    reply.status(403).send(fail('FORBIDDEN', 'User access required'))
  }
}
