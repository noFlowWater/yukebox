import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { fail } from '../types/api.js'
import { config } from '../config/index.js'

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Zod validation error
  if (error.cause instanceof ZodError) {
    const messages = error.cause.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
    return
  }

  // Fastify validation error (from schema)
  if (error.validation) {
    reply.status(400).send(fail('VALIDATION_ERROR', error.message))
    return
  }

  // Known HTTP errors
  if (error.statusCode && error.statusCode < 500) {
    reply.status(error.statusCode).send(fail('CLIENT_ERROR', error.message))
    return
  }

  // Unexpected server errors
  const message = config.nodeEnv === 'production'
    ? 'Internal server error'
    : error.message

  reply.status(500).send(fail('INTERNAL_ERROR', message))
}
