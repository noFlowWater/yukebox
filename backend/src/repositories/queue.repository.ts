import { getDb, renumberQueuePositions } from './db.js'
import type { QueueItem, CreateQueueItem } from '../types/queue.js'

export function findAll(speakerId?: number): QueueItem[] {
  const db = getDb()
  if (speakerId !== undefined) {
    return db.prepare('SELECT * FROM queue WHERE speaker_id = ? ORDER BY position ASC').all(speakerId) as QueueItem[]
  }
  return db.prepare('SELECT * FROM queue ORDER BY position ASC').all() as QueueItem[]
}

export function findById(id: number): QueueItem | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM queue WHERE id = ?').get(id) as QueueItem | undefined
}

export function findFirstPending(): QueueItem | undefined {
  const db = getDb()
  return db.prepare(
    "SELECT * FROM queue WHERE status = 'pending' ORDER BY position ASC LIMIT 1"
  ).get() as QueueItem | undefined
}

export function insert(item: CreateQueueItem): QueueItem {
  const db = getDb()

  const speakerId = item.speaker_id ?? null

  // Positions are per speaker (0..n-1 within each speaker's queue)
  const maxRow = db.prepare('SELECT MAX(position) as max_pos FROM queue WHERE speaker_id IS ?').get(speakerId) as { max_pos: number | null }
  const nextPosition = (maxRow.max_pos ?? -1) + 1

  const result = db.prepare(
    'INSERT INTO queue (url, title, thumbnail, duration, position, speaker_id, schedule_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(item.url, item.title, item.thumbnail, item.duration, nextPosition, speakerId, item.schedule_id ?? null)

  return findById(Number(result.lastInsertRowid))!
}

export function insertAtTop(item: CreateQueueItem): QueueItem {
  const db = getDb()

  const speakerId = item.speaker_id ?? null

  const transaction = db.transaction(() => {
    db.prepare('UPDATE queue SET position = position + 1 WHERE speaker_id IS ?').run(speakerId)
    const result = db.prepare(
      'INSERT INTO queue (url, title, thumbnail, duration, position, speaker_id, schedule_id) VALUES (?, ?, ?, ?, 0, ?, ?)'
    ).run(item.url, item.title, item.thumbnail, item.duration, speakerId, item.schedule_id ?? null)
    return Number(result.lastInsertRowid)
  })

  const id = transaction()
  return findById(id)!
}

export function findAllBySpeaker(speakerId: number): QueueItem[] {
  const db = getDb()
  return db.prepare('SELECT * FROM queue WHERE speaker_id = ? ORDER BY position ASC').all(speakerId) as QueueItem[]
}

export function remove(id: number): boolean {
  const db = getDb()

  const item = findById(id)
  if (!item) return false

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM queue WHERE id = ?').run(item.id)
    db.prepare('UPDATE queue SET position = position - 1 WHERE speaker_id IS ? AND position > ?').run(item.speaker_id, item.position)
  })

  transaction()
  return true
}

export function markPlaying(id: number): boolean {
  const db = getDb()
  const item = findById(id)
  if (!item) return false

  const transaction = db.transaction(() => {
    // Reset any other playing item on the same speaker to pending first
    db.prepare(
      "UPDATE queue SET status = 'pending', paused_position = NULL WHERE status = 'playing' AND id != ? AND speaker_id IS ?"
    ).run(id, item.speaker_id)
    const result = db.prepare("UPDATE queue SET status = 'playing', paused_position = NULL WHERE id = ?").run(id)
    return result.changes > 0
  })
  return transaction()
}

export function pausePlaying(speakerId: number, playbackPosition: number): boolean {
  const db = getDb()
  const result = db.prepare(
    "UPDATE queue SET status = 'paused', paused_position = ? WHERE status = 'playing' AND speaker_id = ?"
  ).run(playbackPosition, speakerId)
  return result.changes > 0
}

export function findPaused(): QueueItem | undefined {
  const db = getDb()
  return db.prepare(
    "SELECT * FROM queue WHERE status = 'paused' ORDER BY position ASC LIMIT 1"
  ).get() as QueueItem | undefined
}

export function clearPending(speakerId?: number): number {
  const db = getDb()
  const result = speakerId !== undefined
    ? db.prepare("DELETE FROM queue WHERE status IN ('pending', 'played', 'failed') AND speaker_id = ?").run(speakerId)
    : db.prepare("DELETE FROM queue WHERE status IN ('pending', 'played', 'failed')").run()
  // Close the position gaps left behind
  db.transaction(() => renumberQueuePositions(db, speakerId))()
  return result.changes
}

export function updatePosition(id: number, newPosition: number): boolean {
  const db = getDb()

  const item = findById(id)
  if (!item) return false

  const oldPosition = item.position

  if (oldPosition === newPosition) return true

  const transaction = db.transaction(() => {
    if (newPosition < oldPosition) {
      db.prepare(
        'UPDATE queue SET position = position + 1 WHERE speaker_id IS ? AND position >= ? AND position < ?'
      ).run(item.speaker_id, newPosition, oldPosition)
    } else {
      db.prepare(
        'UPDATE queue SET position = position - 1 WHERE speaker_id IS ? AND position > ? AND position <= ?'
      ).run(item.speaker_id, oldPosition, newPosition)
    }

    db.prepare('UPDATE queue SET position = ? WHERE id = ?').run(newPosition, id)
  })

  transaction()
  return true
}

export function markPlayed(id: number): boolean {
  const db = getDb()
  const result = db.prepare("UPDATE queue SET status = 'played', paused_position = NULL WHERE id = ?").run(id)
  return result.changes > 0
}

export function markFailed(id: number): boolean {
  const db = getDb()
  const result = db.prepare("UPDATE queue SET status = 'failed', paused_position = NULL WHERE id = ?").run(id)
  return result.changes > 0
}

export function resetPlayedToPending(speakerId: number): number {
  const db = getDb()
  const result = db.prepare("UPDATE queue SET status = 'pending' WHERE status = 'played' AND speaker_id = ?").run(speakerId)
  return result.changes
}

export function resetPlayingToPending(speakerId: number): number {
  const db = getDb()
  const result = db.prepare(
    "UPDATE queue SET status = 'pending', paused_position = NULL WHERE status = 'playing' AND speaker_id = ?"
  ).run(speakerId)
  return result.changes
}

export function moveToBack(id: number): void {
  const db = getDb()
  const item = findById(id)
  if (!item) return

  // Close the gap at the old position, then append at the end of this speaker's queue
  const transaction = db.transaction(() => {
    db.prepare('UPDATE queue SET position = position - 1 WHERE speaker_id IS ? AND position > ?').run(item.speaker_id, item.position)
    const maxRow = db.prepare('SELECT MAX(position) as max_pos FROM queue WHERE speaker_id IS ? AND id != ?').get(item.speaker_id, id) as { max_pos: number | null }
    db.prepare(
      "UPDATE queue SET status = 'pending', position = ?, paused_position = NULL WHERE id = ?",
    ).run((maxRow.max_pos ?? -1) + 1, id)
  })
  transaction()
}

export function findRandomPending(speakerId: number): QueueItem | undefined {
  const db = getDb()
  const items = db.prepare(
    "SELECT * FROM queue WHERE status = 'pending' AND speaker_id = ? ORDER BY position ASC",
  ).all(speakerId) as QueueItem[]
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

export function shuffle(speakerId?: number): void {
  const db = getDb()
  // Only shuffle pending items
  let items: QueueItem[]
  if (speakerId !== undefined) {
    items = db.prepare(
      "SELECT * FROM queue WHERE status = 'pending' AND speaker_id = ? ORDER BY position ASC"
    ).all(speakerId) as QueueItem[]
  } else {
    items = db.prepare(
      "SELECT * FROM queue WHERE status = 'pending' ORDER BY position ASC"
    ).all() as QueueItem[]
  }
  if (items.length <= 1) return

  // Fisher-Yates shuffle on positions
  const positions = items.map((item) => item.position)
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]]
  }

  const transaction = db.transaction(() => {
    for (let i = 0; i < items.length; i++) {
      db.prepare('UPDATE queue SET position = ? WHERE id = ?').run(positions[i], items[i].id)
    }
  })

  transaction()
}
