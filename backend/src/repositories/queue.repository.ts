import { getDb } from './db.js'
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

  const maxRow = db.prepare('SELECT MAX(position) as max_pos FROM queue').get() as { max_pos: number | null }
  const nextPosition = (maxRow.max_pos ?? -1) + 1

  const result = db.prepare(
    'INSERT INTO queue (url, title, thumbnail, duration, position, speaker_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(item.url, item.title, item.thumbnail, item.duration, nextPosition, item.speaker_id ?? null)

  return findById(Number(result.lastInsertRowid))!
}

export function insertAtTop(item: CreateQueueItem): QueueItem {
  const db = getDb()

  const transaction = db.transaction(() => {
    db.prepare('UPDATE queue SET position = position + 1').run()
    const result = db.prepare(
      'INSERT INTO queue (url, title, thumbnail, duration, position, speaker_id) VALUES (?, ?, ?, ?, 0, ?)'
    ).run(item.url, item.title, item.thumbnail, item.duration, item.speaker_id ?? null)
    return Number(result.lastInsertRowid)
  })

  const id = transaction()
  return findById(id)!
}

export function remove(id: number): boolean {
  const db = getDb()

  const item = findById(id)
  if (!item) return false

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM queue WHERE id = ?').run(item.id)
    db.prepare('UPDATE queue SET position = position - 1 WHERE position > ?').run(item.position)
  })

  transaction()
  return true
}

export function markPlaying(id: number): boolean {
  const db = getDb()
  const result = db.prepare("UPDATE queue SET status = 'playing', paused_position = NULL WHERE id = ?").run(id)
  return result.changes > 0
}

export function pausePlaying(playbackPosition: number): boolean {
  const db = getDb()
  const result = db.prepare(
    "UPDATE queue SET status = 'paused', paused_position = ? WHERE status = 'playing'"
  ).run(playbackPosition)
  return result.changes > 0
}

export function findPaused(): QueueItem | undefined {
  const db = getDb()
  return db.prepare(
    "SELECT * FROM queue WHERE status = 'paused' ORDER BY position ASC LIMIT 1"
  ).get() as QueueItem | undefined
}

export function removePlaying(): number {
  const db = getDb()
  const playing = db.prepare("SELECT * FROM queue WHERE status = 'playing'").all() as QueueItem[]
  if (playing.length === 0) return 0

  const transaction = db.transaction(() => {
    for (const item of playing) {
      db.prepare('DELETE FROM queue WHERE id = ?').run(item.id)
      db.prepare('UPDATE queue SET position = position - 1 WHERE position > ?').run(item.position)
    }
  })

  transaction()
  return playing.length
}

export function clearPending(speakerId?: number): number {
  const db = getDb()
  const result = speakerId !== undefined
    ? db.prepare("DELETE FROM queue WHERE status = 'pending' AND speaker_id = ?").run(speakerId)
    : db.prepare("DELETE FROM queue WHERE status = 'pending'").run()
  // Reorder remaining items
  const remaining = db.prepare("SELECT id FROM queue ORDER BY position ASC").all() as { id: number }[]
  const reorder = db.transaction(() => {
    for (let i = 0; i < remaining.length; i++) {
      db.prepare('UPDATE queue SET position = ? WHERE id = ?').run(i, remaining[i].id)
    }
  })
  reorder()
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
        'UPDATE queue SET position = position + 1 WHERE position >= ? AND position < ?'
      ).run(newPosition, oldPosition)
    } else {
      db.prepare(
        'UPDATE queue SET position = position - 1 WHERE position > ? AND position <= ?'
      ).run(oldPosition, newPosition)
    }

    db.prepare('UPDATE queue SET position = ? WHERE id = ?').run(newPosition, id)
  })

  transaction()
  return true
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
