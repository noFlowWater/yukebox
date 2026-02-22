import { getDb } from './db.js'
import type { RefreshToken } from '../types/user.js'

export function insert(userId: number, tokenHash: string, expiresAt: string): RefreshToken {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
  ).run(userId, tokenHash, expiresAt)
  return db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(
    Number(result.lastInsertRowid),
  ) as RefreshToken
}

export function findByTokenHash(tokenHash: string): RefreshToken | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as RefreshToken | undefined
}

export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(id)
  return result.changes > 0
}

export function removeByUserId(userId: number): number {
  const db = getDb()
  const result = db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId)
  return result.changes
}

export function deleteExpired(): number {
  const db = getDb()
  const result = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run()
  return result.changes
}
