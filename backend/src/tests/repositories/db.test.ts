import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, renumberQueuePositions } from '../../repositories/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('db', () => {
  it('should create database connection', () => {
    const db = getDb()
    expect(db).toBeDefined()
    expect(db.open).toBe(true)
  })

  it('should return same instance on multiple calls', () => {
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })

  it('should create queue table', () => {
    const db = getDb()
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='queue'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  it('should create schedules table', () => {
    const db = getDb()
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schedules'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  it('should close and reopen cleanly', () => {
    const db1 = getDb()
    expect(db1.open).toBe(true)
    closeDb()

    const db2 = getDb()
    expect(db2.open).toBe(true)
    expect(db2).not.toBe(db1)
  })

  it('should create speakers table via migration', () => {
    const db = getDb()
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='speakers'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  it('should add speaker_id column to queue table', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(queue)').all() as { name: string }[]
    const speakerIdCol = columns.find((c) => c.name === 'speaker_id')
    expect(speakerIdCol).toBeDefined()
  })

  it('should add speaker_id column to schedules table', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(schedules)').all() as { name: string }[]
    const speakerIdCol = columns.find((c) => c.name === 'speaker_id')
    expect(speakerIdCol).toBeDefined()
  })

  it('should add status column to queue table', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(queue)').all() as { name: string }[]
    const statusCol = columns.find((c) => c.name === 'status')
    expect(statusCol).toBeDefined()
  })

  it('should add group_id column to schedules table', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(schedules)').all() as { name: string }[]
    const groupIdCol = columns.find((c) => c.name === 'group_id')
    expect(groupIdCol).toBeDefined()
  })

  it('should create favorites table', () => {
    const db = getDb()
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='favorites'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  it('should add default_volume column to speakers table', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(speakers)').all() as { name: string }[]
    const col = columns.find((c) => c.name === 'default_volume')
    expect(col).toBeDefined()
  })

  it('should create settings table', () => {
    const db = getDb()
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
    ).all()
    expect(tables).toHaveLength(1)
  })

  it('should seed default_volume setting to 60', () => {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'default_volume'").get() as { value: string }
    expect(row.value).toBe('60')
  })

  it('should add schedule_id column to queue table', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(queue)').all() as { name: string }[]
    const col = columns.find((c) => c.name === 'schedule_id')
    expect(col).toBeDefined()
  })

  it('should set schema_version to 11', () => {
    const db = getDb()
    const row = db.prepare('SELECT version FROM schema_version').get() as { version: number }
    expect(row.version).toBe(11)
  })

  it('should add playback_mode column to speakers in v10', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(speakers)').all() as { name: string; dflt_value: string | null }[]
    const col = columns.find((c) => c.name === 'playback_mode')
    expect(col).toBeDefined()
    expect(col!.dflt_value).toBe("'sequential'")
  })

  it('should create bluetooth_devices table in v9', () => {
    const db = getDb()
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='bluetooth_devices'",
    ).get()
    expect(table).toBeDefined()
  })

  it('should add bt_device_id column to speakers in v9', () => {
    const db = getDb()
    const columns = db.prepare('PRAGMA table_info(speakers)').all() as { name: string }[]
    const col = columns.find((c) => c.name === 'bt_device_id')
    expect(col).toBeDefined()
  })

  it('should renumber legacy global queue positions per speaker', () => {
    const db = getDb()
    db.prepare("INSERT INTO speakers (sink_name, display_name) VALUES ('a', 'A'), ('b', 'B')").run()
    const insert = db.prepare('INSERT INTO queue (url, title, position, speaker_id) VALUES (?, ?, ?, ?)')
    // Legacy layout: one global position sequence shared by all speakers
    insert.run('a1', 'a1', 0, 1)
    insert.run('b1', 'b1', 1, 2)
    insert.run('a2', 'a2', 2, 1)
    insert.run('b2', 'b2', 5, 2)

    renumberQueuePositions(db)

    const rows = db.prepare('SELECT title, position FROM queue ORDER BY speaker_id, position').all()
    expect(rows).toEqual([
      { title: 'a1', position: 0 }, { title: 'a2', position: 1 },
      { title: 'b1', position: 0 }, { title: 'b2', position: 1 },
    ])
  })
})
