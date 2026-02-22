import * as favoriteRepo from '../repositories/favorite.repository.js'
import type { Favorite } from '../types/favorite.js'
import type { AddFavoriteInput } from '../validators/favorite.validator.js'

export function getAll(userId: number): Favorite[] {
  return favoriteRepo.findByUser(userId)
}

export function add(userId: number, input: AddFavoriteInput): Favorite {
  return favoriteRepo.insert({
    user_id: userId,
    url: input.url,
    title: input.title,
    thumbnail: input.thumbnail,
    duration: input.duration,
  })
}

export function remove(userId: number, id: number): boolean {
  const favorite = favoriteRepo.findById(id)
  if (!favorite) return false
  if (favorite.user_id !== userId) return false
  return favoriteRepo.remove(id)
}

export function checkBulk(userId: number, urls: string[]): Record<string, number | null> {
  const favorites = favoriteRepo.findByUserAndUrls(userId, urls)
  const urlToId = new Map(favorites.map((f) => [f.url, f.id]))
  const result: Record<string, number | null> = {}
  for (const url of urls) {
    result[url] = urlToId.get(url) ?? null
  }
  return result
}
