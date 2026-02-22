import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../../repositories/db.js'
import * as queueRepo from '../../repositories/queue.repository.js'

// Use in-memory DB for tests
beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('queue.repository', () => {
  it('should start with empty queue', () => {
    const items = queueRepo.findAll()
    expect(items).toHaveLength(0)
  })

  it('should insert an item with auto-incremented position and pending status', () => {
    const item = queueRepo.insert({
      url: 'https://youtube.com/watch?v=abc',
      title: 'Test Song',
      thumbnail: 'https://img.youtube.com/vi/abc/0.jpg',
      duration: 180,
    })

    expect(item.id).toBe(1)
    expect(item.position).toBe(0)
    expect(item.title).toBe('Test Song')
    expect(item.status).toBe('pending')
  })

  it('should assign sequential positions', () => {
    queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    const items = queueRepo.findAll()
    expect(items).toHaveLength(3)
    expect(items[0].position).toBe(0)
    expect(items[1].position).toBe(1)
    expect(items[2].position).toBe(2)
  })

  it('should find item by id', () => {
    const inserted = queueRepo.insert({ url: 'url1', title: 'Song', thumbnail: '', duration: 100 })
    const found = queueRepo.findById(inserted.id)
    expect(found).toBeDefined()
    expect(found!.url).toBe('url1')
  })

  it('should return undefined for non-existent id', () => {
    const found = queueRepo.findById(999)
    expect(found).toBeUndefined()
  })

  it('should remove an item and reorder positions', () => {
    queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.remove(item2.id)
    const remaining = queueRepo.findAll()
    expect(remaining).toHaveLength(2)
    expect(remaining[0].position).toBe(0)
    expect(remaining[1].position).toBe(1)
  })

  it('should return false when removing non-existent item', () => {
    const removed = queueRepo.remove(999)
    expect(removed).toBe(false)
  })

  it('should move item to earlier position', () => {
    queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    const third = queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.updatePosition(third.id, 0)

    const items = queueRepo.findAll()
    expect(items[0].title).toBe('Song 3')
    expect(items[1].title).toBe('Song 1')
    expect(items[2].title).toBe('Song 2')
  })

  it('should move item to later position', () => {
    const first = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.updatePosition(first.id, 2)

    const items = queueRepo.findAll()
    expect(items[0].title).toBe('Song 2')
    expect(items[1].title).toBe('Song 3')
    expect(items[2].title).toBe('Song 1')
  })

  it('should mark an item as playing', () => {
    const item = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })

    queueRepo.markPlaying(item.id)

    const found = queueRepo.findById(item.id)
    expect(found!.status).toBe('playing')
  })

  it('should find first pending item', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })

    // Mark first as playing
    queueRepo.markPlaying(item1.id)

    const next = queueRepo.findFirstPending()
    expect(next).toBeDefined()
    expect(next!.title).toBe('Song 2')
  })

  it('should remove playing items and reorder', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.markPlaying(item1.id)
    const removed = queueRepo.removePlaying()
    expect(removed).toBe(1)

    const remaining = queueRepo.findAll()
    expect(remaining).toHaveLength(2)
    expect(remaining[0].position).toBe(0)
    expect(remaining[0].title).toBe('Song 2')
  })

  it('should clear pending items only', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.markPlaying(item1.id)
    const cleared = queueRepo.clearPending()
    expect(cleared).toBe(2)

    const remaining = queueRepo.findAll()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('Song 1')
    expect(remaining[0].status).toBe('playing')
  })

  it('should only shuffle pending items', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.markPlaying(item1.id)

    // Shuffle should not affect playing item
    queueRepo.shuffle()
    const items = queueRepo.findAll()
    const playing = items.find((i) => i.status === 'playing')
    expect(playing!.title).toBe('Song 1')
  })
})
