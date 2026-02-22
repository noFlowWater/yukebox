import { getDb } from './db.js'
import type { Schedule, CreateSchedule } from '../types/schedule.js'

export function findAll(speakerId?: number): Schedule[] {
  const db = getDb()
  if (speakerId !== undefined) {
    return db.prepare('SELECT * FROM schedules WHERE speaker_id = ? ORDER BY scheduled_at ASC').all(speakerId) as Schedule[]
  }
  return db.prepare('SELECT * FROM schedules ORDER BY scheduled_at ASC').all() as Schedule[]
}

export function findById(id: number): Schedule | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as Schedule | undefined
}

export function findPending(): Schedule[] {
  const db = getDb()
  return db.prepare(
    "SELECT * FROM schedules WHERE status = 'pending' ORDER BY scheduled_at ASC"
  ).all() as Schedule[]
}

export function findByStatus(status: string): Schedule[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM schedules WHERE status = ? ORDER BY scheduled_at ASC'
  ).all(status) as Schedule[]
}

export function findDue(now: string): Schedule[] {
  const db = getDb()
  return db.prepare(
    "SELECT * FROM schedules WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC"
  ).all(now) as Schedule[]
}

export function findPendingByGroup(groupId: string): Schedule[] {
  const db = getDb()
  return db.prepare(
    "SELECT * FROM schedules WHERE status = 'pending' AND group_id = ? ORDER BY scheduled_at ASC"
  ).all(groupId) as Schedule[]
}

export function insert(item: CreateSchedule): Schedule {
  const db = getDb()

  const result = db.prepare(
    'INSERT INTO schedules (url, query, title, thumbnail, duration, scheduled_at, group_id, speaker_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(item.url ?? '', item.query ?? '', item.title, item.thumbnail ?? '', item.duration ?? 0, item.scheduled_at, item.group_id ?? null, item.speaker_id ?? null)

  return findById(Number(result.lastInsertRowid))!
}

export function updateStatus(id: number, status: string): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE schedules SET status = ? WHERE id = ?').run(status, id)
  return result.changes > 0
}

export function updateScheduledAt(id: number, scheduledAt: string): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE schedules SET scheduled_at = ? WHERE id = ?').run(scheduledAt, id)
  return result.changes > 0
}

export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
  return result.changes > 0
}

export function removeAll(speakerId?: number): number {
  const db = getDb()
  if (speakerId !== undefined) {
    const result = db.prepare('DELETE FROM schedules WHERE speaker_id = ?').run(speakerId)
    return result.changes
  }
  const result = db.prepare('DELETE FROM schedules').run()
  return result.changes
}
