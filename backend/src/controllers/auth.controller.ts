import type { FastifyRequest, FastifyReply } from 'fastify'
import { registerSchema, loginSchema } from '../validators/auth.validator.js'
import * as authService from '../services/auth.service.js'
import { AuthError } from '../services/auth.service.js'
import * as userRepo from '../repositories/user.repository.js'
import { toPublicUser } from '../types/user.js'
import { ok, fail } from '../types/api.js'
import { config } from '../config/index.js'

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 900, // 15 minutes
}

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax' as const,
  path: '/api/auth/refresh',
  maxAge: 604800, // 7 days
}

export async function handleRegister(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    await authService.register(parsed.data.username, parsed.data.password)

    const { user, accessToken, refreshToken } = await authService.login(
      parsed.data.username,
      parsed.data.password,
    )

    reply
      .setCookie('access_token', accessToken, ACCESS_COOKIE_OPTIONS)
      .setCookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS)
      .status(201)
      .send(ok(user))
  } catch (err) {
    if (err instanceof AuthError) {
      reply.status(409).send(fail(err.code, err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('REGISTER_ERROR', message))
  }
}

export async function handleLogin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const { user, accessToken, refreshToken } = await authService.login(
      parsed.data.username,
      parsed.data.password,
    )

    reply
      .setCookie('access_token', accessToken, ACCESS_COOKIE_OPTIONS)
      .setCookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS)
      .status(200)
      .send(ok(user))
  } catch (err) {
    if (err instanceof AuthError) {
      reply.status(401).send(fail(err.code, err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('LOGIN_ERROR', message))
  }
}

export async function handleLogout(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const refreshToken = request.cookies?.refresh_token
    if (refreshToken) {
      await authService.logout(refreshToken)
    }

    reply
      .clearCookie('access_token', { path: '/' })
      .clearCookie('refresh_token', { path: '/api/auth/refresh' })
      .status(200)
      .send(ok({ loggedOut: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('LOGOUT_ERROR', message))
  }
}

export async function handleRefresh(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const refreshToken = request.cookies?.refresh_token
    if (!refreshToken) {
      reply.status(401).send(fail('UNAUTHORIZED', 'No refresh token'))
      return
    }

    const { user, accessToken, refreshToken: newRefreshToken } = await authService.refresh(refreshToken)

    reply
      .setCookie('access_token', accessToken, ACCESS_COOKIE_OPTIONS)
      .setCookie('refresh_token', newRefreshToken, REFRESH_COOKIE_OPTIONS)
      .status(200)
      .send(ok(user))
  } catch (err) {
    if (err instanceof AuthError) {
      reply
        .clearCookie('access_token', { path: '/' })
        .clearCookie('refresh_token', { path: '/api/auth/refresh' })
        .status(401)
        .send(fail(err.code, err.message))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('REFRESH_ERROR', message))
  }
}

export async function handleSetupStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    reply.status(200).send(ok({ hasUsers: authService.hasUsers() }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('AUTH_ERROR', message))
  }
}

export async function handleMe(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const user = userRepo.findById(request.userId)
    if (!user) {
      reply.status(404).send(fail('USER_NOT_FOUND', 'User not found'))
      return
    }
    reply.status(200).send(ok(toPublicUser(user)))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('AUTH_ERROR', message))
  }
}
