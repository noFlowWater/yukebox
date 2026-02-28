import Database from 'better-sqlite3'
import { config } from '../config/index.js'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      thumbnail TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL DEFAULT '',
      query TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  runMigrations(db)
}

function getSchemaVersion(db: Database.Database): number {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
  ).get()
  if (!tableExists) return 0

  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
  return row?.version ?? 0
}

function runMigrations(db: Database.Database): void {
  const version = getSchemaVersion(db)

  if (version < 1) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER NOT NULL
        )
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS speakers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sink_name TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      db.exec(`ALTER TABLE queue ADD COLUMN speaker_id INTEGER REFERENCES speakers(id) ON DELETE SET NULL`)
      db.exec(`ALTER TABLE schedules ADD COLUMN speaker_id INTEGER REFERENCES speakers(id) ON DELETE SET NULL`)

      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1)
    })()
  }

  if (version < 2) {
    db.transaction(() => {
      db.exec(`ALTER TABLE queue ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`)
      db.prepare('UPDATE schema_version SET version = ?').run(2)
    })()
  }

  if (version < 3) {
    db.transaction(() => {
      db.exec(`ALTER TABLE schedules ADD COLUMN group_id TEXT`)
      db.prepare('UPDATE schema_version SET version = ?').run(3)
    })()
  }

  if (version < 4) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          thumbnail TEXT NOT NULL DEFAULT '',
          duration INTEGER NOT NULL DEFAULT 0,
          added_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, url)
        )
      `)
      db.prepare('UPDATE schema_version SET version = ?').run(4)
    })()
  }

  if (version < 5) {
    db.transaction(() => {
      db.exec(`ALTER TABLE schedules ADD COLUMN thumbnail TEXT NOT NULL DEFAULT ''`)
      db.exec(`ALTER TABLE schedules ADD COLUMN duration INTEGER NOT NULL DEFAULT 0`)
      db.prepare('UPDATE schema_version SET version = ?').run(5)
    })()
  }

  if (version < 6) {
    db.transaction(() => {
      db.exec(`ALTER TABLE queue ADD COLUMN paused_position REAL`)
      db.prepare('UPDATE schema_version SET version = ?').run(6)
    })()
  }

  if (version < 7) {
    db.transaction(() => {
      db.exec(`ALTER TABLE speakers ADD COLUMN default_volume INTEGER`)
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `)
      db.exec(`INSERT INTO settings (key, value) VALUES ('default_volume', '60')`)
      db.prepare('UPDATE schema_version SET version = ?').run(7)
    })()
  }

  if (version < 8) {
    db.transaction(() => {
      db.exec(`ALTER TABLE queue ADD COLUMN schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL`)
      db.prepare('UPDATE schema_version SET version = ?').run(8)
    })()
  }

  if (version < 9) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS bluetooth_devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          alias TEXT,
          sink_name TEXT,
          is_connected INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      db.exec(`ALTER TABLE speakers ADD COLUMN bt_device_id INTEGER REFERENCES bluetooth_devices(id) ON DELETE SET NULL`)
      db.prepare('UPDATE schema_version SET version = ?').run(9)
    })()
  }

  if (version < 10) {
    db.transaction(() => {
      db.exec(`ALTER TABLE speakers ADD COLUMN playback_mode TEXT NOT NULL DEFAULT 'sequential'`)
      db.prepare('UPDATE schema_version SET version = ?').run(10)
    })()
  }
}
