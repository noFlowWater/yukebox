import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../../repositories/db.js'
import * as btRepo from '../../repositories/bluetooth.repository.js'
import * as speakerRepo from '../../repositories/speaker.repository.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('bluetooth.repository', () => {
  it('should start with no devices', () => {
    const devices = btRepo.findAll()
    expect(devices).toHaveLength(0)
  })

  it('should upsert a new device', () => {
    const device = btRepo.upsert('AA:BB:CC:DD:EE:FF', 'JBL Flip 6')
    expect(device.id).toBe(1)
    expect(device.address).toBe('AA:BB:CC:DD:EE:FF')
    expect(device.name).toBe('JBL Flip 6')
    expect(device.is_connected).toBe(0)
    expect(device.alias).toBeNull()
    expect(device.sink_name).toBeNull()
  })

  it('should update name on upsert with existing address', () => {
    btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Old Name')
    const updated = btRepo.upsert('AA:BB:CC:DD:EE:FF', 'New Name')
    expect(updated.name).toBe('New Name')

    const all = btRepo.findAll()
    expect(all).toHaveLength(1)
  })

  it('should find by address', () => {
    btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')
    const found = btRepo.findByAddress('AA:BB:CC:DD:EE:FF')
    expect(found).toBeDefined()
    expect(found!.name).toBe('Speaker')
  })

  it('should return undefined for unknown address', () => {
    const found = btRepo.findByAddress('00:00:00:00:00:00')
    expect(found).toBeUndefined()
  })

  it('should find by id', () => {
    const device = btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')
    const found = btRepo.findById(device.id)
    expect(found).toBeDefined()
    expect(found!.address).toBe('AA:BB:CC:DD:EE:FF')
  })

  it('should update connection status', () => {
    btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')
    btRepo.updateConnectionStatus('AA:BB:CC:DD:EE:FF', true)

    const found = btRepo.findByAddress('AA:BB:CC:DD:EE:FF')
    expect(found!.is_connected).toBe(1)

    btRepo.updateConnectionStatus('AA:BB:CC:DD:EE:FF', false)
    const found2 = btRepo.findByAddress('AA:BB:CC:DD:EE:FF')
    expect(found2!.is_connected).toBe(0)
  })

  it('should update sink name', () => {
    btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')
    btRepo.updateSinkName('AA:BB:CC:DD:EE:FF', 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink')

    const found = btRepo.findByAddress('AA:BB:CC:DD:EE:FF')
    expect(found!.sink_name).toBe('bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink')
  })

  it('should update alias', () => {
    const device = btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')
    btRepo.updateAlias(device.id, 'Kitchen')

    const found = btRepo.findById(device.id)
    expect(found!.alias).toBe('Kitchen')
  })

  it('should remove a device', () => {
    const device = btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')
    const removed = btRepo.remove(device.id)
    expect(removed).toBe(true)
    expect(btRepo.findAll()).toHaveLength(0)
  })

  it('should return false when removing non-existent device', () => {
    const removed = btRepo.remove(999)
    expect(removed).toBe(false)
  })

  it('should find all with speaker join', () => {
    const device = btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')
    speakerRepo.insertWithBtDevice('bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink', 'Kitchen Speaker', device.id)

    const results = btRepo.findAllWithSpeaker()
    expect(results).toHaveLength(1)
    expect(results[0].speaker_id).toBeDefined()
    expect(results[0].speaker_name).toBe('Kitchen Speaker')
  })

  it('should return null speaker fields when no speaker linked', () => {
    btRepo.upsert('AA:BB:CC:DD:EE:FF', 'Speaker')

    const results = btRepo.findAllWithSpeaker()
    expect(results).toHaveLength(1)
    expect(results[0].speaker_id).toBeNull()
    expect(results[0].speaker_name).toBeNull()
  })
})
