import { getDb } from './db.js'
import type { BluetoothDevice } from '../types/bluetooth.js'

export interface BluetoothDeviceWithSpeaker extends BluetoothDevice {
  speaker_id: number | null
  speaker_name: string | null
}

export function findAll(): BluetoothDevice[] {
  const db = getDb()
  return db.prepare('SELECT * FROM bluetooth_devices ORDER BY created_at').all() as BluetoothDevice[]
}

export function findByAddress(address: string): BluetoothDevice | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM bluetooth_devices WHERE address = ?').get(address) as BluetoothDevice | undefined
}

export function findById(id: number): BluetoothDevice | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM bluetooth_devices WHERE id = ?').get(id) as BluetoothDevice | undefined
}

export function upsert(address: string, name: string): BluetoothDevice {
  const db = getDb()
  db.prepare(
    `INSERT INTO bluetooth_devices (address, name) VALUES (?, ?)
     ON CONFLICT(address) DO UPDATE SET name = excluded.name`,
  ).run(address, name)
  return findByAddress(address)!
}

export function updateSinkName(address: string, sinkName: string): void {
  const db = getDb()
  db.prepare('UPDATE bluetooth_devices SET sink_name = ? WHERE address = ?').run(sinkName, address)
}

export function updateConnectionStatus(address: string, connected: boolean): void {
  const db = getDb()
  db.prepare('UPDATE bluetooth_devices SET is_connected = ? WHERE address = ?').run(connected ? 1 : 0, address)
}

export function updateAlias(id: number, alias: string): void {
  const db = getDb()
  db.prepare('UPDATE bluetooth_devices SET alias = ? WHERE id = ?').run(alias, id)
}

export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM bluetooth_devices WHERE id = ?').run(id)
  return result.changes > 0
}

export function findAllWithSpeaker(): BluetoothDeviceWithSpeaker[] {
  const db = getDb()
  return db.prepare(`
    SELECT bd.*, s.id AS speaker_id, s.display_name AS speaker_name
    FROM bluetooth_devices bd
    LEFT JOIN speakers s ON s.bt_device_id = bd.id
    ORDER BY bd.created_at
  `).all() as BluetoothDeviceWithSpeaker[]
}
