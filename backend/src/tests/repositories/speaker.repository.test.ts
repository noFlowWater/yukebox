import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../../repositories/db.js'
import * as speakerRepo from '../../repositories/speaker.repository.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('speaker.repository', () => {
  it('should start with no speakers', () => {
    const speakers = speakerRepo.findAll()
    expect(speakers).toHaveLength(0)
    expect(speakerRepo.count()).toBe(0)
  })

  it('should insert a speaker', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    expect(speaker.id).toBe(1)
    expect(speaker.sink_name).toBe('sink1')
    expect(speaker.display_name).toBe('Living Room')
    expect(speaker.is_default).toBe(0)
    expect(speaker.created_at).toBeDefined()
  })

  it('should find all speakers ordered by created_at', () => {
    speakerRepo.insert('sink1', 'Living Room')
    speakerRepo.insert('sink2', 'Bedroom')
    speakerRepo.insert('sink3', 'Kitchen')

    const speakers = speakerRepo.findAll()
    expect(speakers).toHaveLength(3)
    expect(speakers[0].display_name).toBe('Living Room')
    expect(speakers[1].display_name).toBe('Bedroom')
    expect(speakers[2].display_name).toBe('Kitchen')
  })

  it('should find speaker by id', () => {
    const inserted = speakerRepo.insert('sink1', 'Living Room')
    const found = speakerRepo.findById(inserted.id)
    expect(found).toBeDefined()
    expect(found!.sink_name).toBe('sink1')
  })

  it('should return undefined for non-existent id', () => {
    const found = speakerRepo.findById(999)
    expect(found).toBeUndefined()
  })

  it('should find speaker by sink_name', () => {
    speakerRepo.insert('sink1', 'Living Room')
    const found = speakerRepo.findBySinkName('sink1')
    expect(found).toBeDefined()
    expect(found!.display_name).toBe('Living Room')
  })

  it('should return undefined for non-existent sink_name', () => {
    const found = speakerRepo.findBySinkName('nonexistent')
    expect(found).toBeUndefined()
  })

  it('should enforce UNIQUE constraint on sink_name', () => {
    speakerRepo.insert('sink1', 'Living Room')
    expect(() => speakerRepo.insert('sink1', 'Duplicate')).toThrow()
  })

  it('should remove a speaker', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    const removed = speakerRepo.remove(speaker.id)
    expect(removed).toBe(true)
    expect(speakerRepo.findAll()).toHaveLength(0)
  })

  it('should return false when removing non-existent speaker', () => {
    const removed = speakerRepo.remove(999)
    expect(removed).toBe(false)
  })

  it('should set default speaker', () => {
    const s1 = speakerRepo.insert('sink1', 'Living Room')
    const s2 = speakerRepo.insert('sink2', 'Bedroom')

    speakerRepo.setDefault(s1.id)
    expect(speakerRepo.findDefault()!.id).toBe(s1.id)

    // Setting a new default should clear the previous one
    speakerRepo.setDefault(s2.id)
    const defaultSpeaker = speakerRepo.findDefault()
    expect(defaultSpeaker!.id).toBe(s2.id)

    // Verify the old default is no longer default
    const s1Updated = speakerRepo.findById(s1.id)
    expect(s1Updated!.is_default).toBe(0)
  })

  it('should return undefined when no default is set', () => {
    speakerRepo.insert('sink1', 'Living Room')
    const defaultSpeaker = speakerRepo.findDefault()
    expect(defaultSpeaker).toBeUndefined()
  })

  it('should update display_name', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    const updated = speakerRepo.update(speaker.id, 'Main Room')
    expect(updated).toBe(true)

    const found = speakerRepo.findById(speaker.id)
    expect(found!.display_name).toBe('Main Room')
  })

  it('should return false when updating non-existent speaker', () => {
    const updated = speakerRepo.update(999, 'Nope')
    expect(updated).toBe(false)
  })

  it('should count speakers correctly', () => {
    expect(speakerRepo.count()).toBe(0)
    speakerRepo.insert('sink1', 'Living Room')
    expect(speakerRepo.count()).toBe(1)
    speakerRepo.insert('sink2', 'Bedroom')
    expect(speakerRepo.count()).toBe(2)
  })

  it('should have null default_volume on insert', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    expect(speaker.default_volume).toBeNull()
  })

  it('should update default_volume', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    const updated = speakerRepo.updateDefaultVolume(speaker.id, 75)
    expect(updated).toBe(true)

    const found = speakerRepo.findById(speaker.id)
    expect(found!.default_volume).toBe(75)
  })

  it('should set default_volume back to null', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    speakerRepo.updateDefaultVolume(speaker.id, 80)
    speakerRepo.updateDefaultVolume(speaker.id, null)

    const found = speakerRepo.findById(speaker.id)
    expect(found!.default_volume).toBeNull()
  })

  it('should return false when updating volume for non-existent speaker', () => {
    const updated = speakerRepo.updateDefaultVolume(999, 50)
    expect(updated).toBe(false)
  })

  it('should default playback_mode to sequential', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    expect(speaker.playback_mode).toBe('sequential')
    expect(speakerRepo.getPlaybackMode(speaker.id)).toBe('sequential')
  })

  it('should update playback_mode', () => {
    const speaker = speakerRepo.insert('sink1', 'Living Room')
    const updated = speakerRepo.updatePlaybackMode(speaker.id, 'shuffle')
    expect(updated).toBe(true)
    expect(speakerRepo.getPlaybackMode(speaker.id)).toBe('shuffle')
  })

  it('should return sequential for non-existent speaker playback mode', () => {
    expect(speakerRepo.getPlaybackMode(999)).toBe('sequential')
  })
})
