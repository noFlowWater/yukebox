import type { FastifyRequest, FastifyReply } from 'fastify'
import * as favoriteService from '../services/favorite.service.js'
import { addFavoriteSchema, checkBulkFavoritesSchema } from '../validators/favorite.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleGetFavorites(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const items = favoriteService.getAll(request.userId)
    reply.status(200).send(ok(items))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('FAVORITES_ERROR', message))
  }
}

export async function handleAddFavorite(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = addFavoriteSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const item = favoriteService.add(request.userId, parsed.data)
    reply.status(201).send(ok(item))
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      reply.status(409).send(fail('ALREADY_FAVORITED', 'This URL is already in your favorites'))
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('FAVORITE_ADD_ERROR', message))
  }
}

export async function handleRemoveFavorite(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt(request.params.id, 10)
    if (isNaN(id)) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid id'))
      return
    }

    const removed = favoriteService.remove(request.userId, id)
    if (!removed) {
      reply.status(404).send(fail('NOT_FOUND', 'Favorite not found'))
      return
    }

    reply.status(200).send(ok({ removed: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('FAVORITE_REMOVE_ERROR', message))
  }
}

export async function handleCheckBulkFavorites(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = checkBulkFavoritesSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const result = favoriteService.checkBulk(request.userId, parsed.data.urls)
    reply.status(200).send(ok(result))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('FAVORITES_CHECK_ERROR', message))
  }
}
