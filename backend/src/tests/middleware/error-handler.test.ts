import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { ZodError, z } from 'zod'
import { errorHandler } from '../../middleware/error-handler.js'

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(errorHandler)

  // Route that throws Zod validation error
  app.post('/zod-error', async (request) => {
    const schema = z.object({ name: z.string().min(1) })
    try {
      schema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        const error = new Error('Validation failed') as Error & { cause: ZodError; statusCode: number }
        error.cause = err
        error.statusCode = 400
        throw error
      }
    }
  })

  // Route that throws a client error
  app.get('/not-found', async () => {
    const error = new Error('Resource not found') as Error & { statusCode: number }
    error.statusCode = 404
    throw error
  })

  // Route that throws a server error
  app.get('/server-error', async () => {
    throw new Error('Something broke')
  })

  return app
}

describe('errorHandler', () => {
  let app: ReturnType<typeof buildTestApp>

  beforeAll(async () => {
    app = buildTestApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should handle Zod validation errors as 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/zod-error',
      payload: { name: '' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should handle client errors with their status code', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/not-found',
    })

    expect(response.statusCode).toBe(404)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CLIENT_ERROR')
    expect(body.error.message).toBe('Resource not found')
  })

  it('should handle server errors as 500', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/server-error',
    })

    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
