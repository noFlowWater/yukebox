import { getDb } from './db.js'
import type { User } from '../types/user.js'

export function findByUsername(username: string): User | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined
}

export function findById(id: number): User | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
}

export function updateRole(id: number, role: 'admin' | 'user'): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  return result.changes > 0
}

export function insert(username: string, passwordHash: string, role: 'admin' | 'user'): User {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
  ).run(username, passwordHash, role)
  return findById(Number(result.lastInsertRowid))!
}

export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return result.changes > 0
}

export function count(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  return row.count
}

export function countAdmins(): number {
  const db = getDb()
  const row = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number }
  return row.count
}

export function findAll(): User[] {
  const db = getDb()
  return db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as User[]
}
