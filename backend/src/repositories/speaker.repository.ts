import { getDb } from './db.js'
import type { Speaker } from '../types/speaker.js'

export function insert(sinkName: string, displayName: string): Speaker {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO speakers (sink_name, display_name) VALUES (?, ?)',
  ).run(sinkName, displayName)
  return findById(Number(result.lastInsertRowid))!
}

export function findAll(): Speaker[] {
  const db = getDb()
  return db.prepare('SELECT * FROM speakers ORDER BY created_at').all() as Speaker[]
}

export function findById(id: number): Speaker | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM speakers WHERE id = ?').get(id) as Speaker | undefined
}

export function findBySinkName(sinkName: string): Speaker | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM speakers WHERE sink_name = ?').get(sinkName) as Speaker | undefined
}

export function findDefault(): Speaker | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM speakers WHERE is_default = 1').get() as Speaker | undefined
}

export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM speakers WHERE id = ?').run(id)
  return result.changes > 0
}

export function setDefault(id: number): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('UPDATE speakers SET is_default = 0 WHERE is_default = 1').run()
    db.prepare('UPDATE speakers SET is_default = 1 WHERE id = ?').run(id)
  })()
}

export function update(id: number, displayName: string): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE speakers SET display_name = ? WHERE id = ?').run(displayName, id)
  return result.changes > 0
}

export function count(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM speakers').get() as { count: number }
  return row.count
}

export function updateDefaultVolume(id: number, volume: number | null): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE speakers SET default_volume = ? WHERE id = ?').run(volume, id)
  return result.changes > 0
}
