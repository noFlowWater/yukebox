import { getDb } from './db.js'
import type { Favorite, CreateFavorite } from '../types/favorite.js'

export function findByUser(userId: number): Favorite[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC'
  ).all(userId) as Favorite[]
}

export function findById(id: number): Favorite | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM favorites WHERE id = ?').get(id) as Favorite | undefined
}

export function insert(item: CreateFavorite): Favorite {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO favorites (user_id, url, title, thumbnail, duration) VALUES (?, ?, ?, ?, ?)'
  ).run(item.user_id, item.url, item.title, item.thumbnail, item.duration)
  return findById(Number(result.lastInsertRowid))!
}

export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM favorites WHERE id = ?').run(id)
  return result.changes > 0
}

export function findByUserAndUrls(userId: number, urls: string[]): Favorite[] {
  const db = getDb()
  const placeholders = urls.map(() => '?').join(', ')
  return db.prepare(
    `SELECT * FROM favorites WHERE user_id = ? AND url IN (${placeholders})`
  ).all(userId, ...urls) as Favorite[]
}
