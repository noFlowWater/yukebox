import type { FastifyInstance } from 'fastify'
import {
  handleGetFavorites,
  handleAddFavorite,
  handleRemoveFavorite,
  handleCheckBulkFavorites,
} from '../controllers/favorite.controller.js'

export default async function favoriteRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/favorites', handleGetFavorites)
  app.post('/api/favorites', handleAddFavorite)
  app.delete('/api/favorites/:id', handleRemoveFavorite)
  app.post('/api/favorites/check', handleCheckBulkFavorites)
}
