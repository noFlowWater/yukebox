import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../../repositories/db.js'
import * as queueRepo from '../../repositories/queue.repository.js'
import * as speakerRepo from '../../repositories/speaker.repository.js'

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

  it('should mark an item as failed and keep it in place', () => {
    queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.markPlaying(item2.id)
    expect(queueRepo.markFailed(item2.id)).toBe(true)

    const items = queueRepo.findAll()
    expect(items).toHaveLength(3)
    expect(items[1].id).toBe(item2.id)
    expect(items[1].status).toBe('failed')
    expect(items[1].paused_position).toBeNull()
  })

  it('should return false when marking a missing item as failed', () => {
    expect(queueRepo.markFailed(999)).toBe(false)
  })

  it('should not treat failed items as pending', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })

    queueRepo.markFailed(item1.id)

    expect(queueRepo.findFirstPending()!.title).toBe('Song 2')
  })

  it('should include failed items when clearing', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.markPlaying(item1.id)
    queueRepo.markFailed(item2.id)

    expect(queueRepo.clearPending()).toBe(2) // failed + pending

    const remaining = queueRepo.findAll()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].status).toBe('playing')
  })

  it('should keep failed items when resetting playing items on startup', () => {
    const speaker = speakerRepo.insert('sink1', 'Test Speaker')
    const item = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100, speaker_id: speaker.id })
    queueRepo.markFailed(item.id)

    queueRepo.resetPlayingToPending(speaker.id)

    expect(queueRepo.findById(item.id)!.status).toBe('failed')
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

  it('should move item to back of queue with pending status', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.markPlaying(item1.id)
    queueRepo.moveToBack(item1.id)

    const items = queueRepo.findAll()
    expect(items).toHaveLength(3)

    // Song 1 should now be last with pending status
    const moved = items.find((i) => i.title === 'Song 1')
    expect(moved!.status).toBe('pending')
    expect(moved!.position).toBeGreaterThan(items.find((i) => i.title === 'Song 3')!.position)
  })

  it('should find a random pending item for a speaker', () => {
    const speaker = speakerRepo.insert('sink1', 'Test Speaker')
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100, speaker_id: speaker.id })
    queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200, speaker_id: speaker.id })
    queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300, speaker_id: speaker.id })

    queueRepo.markPlaying(item1.id)

    // Should only return pending items
    const random = queueRepo.findRandomPending(speaker.id)
    expect(random).toBeDefined()
    expect(random!.status).toBe('pending')
    expect(['Song 2', 'Song 3']).toContain(random!.title)
  })

  it('should return undefined when no pending items for findRandomPending', () => {
    const speaker = speakerRepo.insert('sink1', 'Test Speaker')
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100, speaker_id: speaker.id })
    queueRepo.markPlaying(item1.id)

    const random = queueRepo.findRandomPending(speaker.id)
    expect(random).toBeUndefined()
  })

  it('should reset other playing items to pending when marking a new one as playing', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })

    queueRepo.markPlaying(item1.id)
    queueRepo.markPlaying(item2.id)

    const found1 = queueRepo.findById(item1.id)
    const found2 = queueRepo.findById(item2.id)
    expect(found1!.status).toBe('pending')
    expect(found2!.status).toBe('playing')
  })

  it('should mark an item as played', () => {
    const item = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    queueRepo.markPlaying(item.id)
    queueRepo.markPlayed(item.id)

    const found = queueRepo.findById(item.id)
    expect(found!.status).toBe('played')
    expect(found!.paused_position).toBeNull()
  })

  it('should reset played items to pending for a specific speaker', () => {
    const speaker = speakerRepo.insert('sink1', 'Test Speaker')
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100, speaker_id: speaker.id })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200, speaker_id: speaker.id })

    queueRepo.markPlayed(item1.id)
    queueRepo.markPlayed(item2.id)

    const count = queueRepo.resetPlayedToPending(speaker.id)
    expect(count).toBe(2)

    const found1 = queueRepo.findById(item1.id)
    const found2 = queueRepo.findById(item2.id)
    expect(found1!.status).toBe('pending')
    expect(found2!.status).toBe('pending')
  })

  it('should clear played items along with pending items', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })
    const item3 = queueRepo.insert({ url: 'url3', title: 'Song 3', thumbnail: '', duration: 300 })

    queueRepo.markPlaying(item1.id)
    queueRepo.markPlayed(item2.id)
    // item3 stays pending

    const cleared = queueRepo.clearPending()
    expect(cleared).toBe(2) // pending + played

    const remaining = queueRepo.findAll()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].status).toBe('playing')
  })

  it('should not include played items in findFirstPending', () => {
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100 })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200 })

    queueRepo.markPlayed(item1.id)

    const next = queueRepo.findFirstPending()
    expect(next).toBeDefined()
    expect(next!.title).toBe('Song 2')
  })

  it('should not include played items in findRandomPending', () => {
    const speaker = speakerRepo.insert('sink1', 'Test Speaker')
    const item1 = queueRepo.insert({ url: 'url1', title: 'Song 1', thumbnail: '', duration: 100, speaker_id: speaker.id })
    const item2 = queueRepo.insert({ url: 'url2', title: 'Song 2', thumbnail: '', duration: 200, speaker_id: speaker.id })

    queueRepo.markPlayed(item1.id)
    queueRepo.markPlayed(item2.id)

    const random = queueRepo.findRandomPending(speaker.id)
    expect(random).toBeUndefined()
  })
})

describe('queue.repository — per-speaker isolation', () => {
  function setup() {
    const a = speakerRepo.insert('sink_a', 'Speaker A').id
    const b = speakerRepo.insert('sink_b', 'Speaker B').id
    const add = (speakerId: number, title: string) =>
      queueRepo.insert({ url: title, title, thumbnail: '', duration: 100, speaker_id: speakerId })
    return { a, b, add }
  }

  function snapshot(speakerId: number): Array<[string, number, string]> {
    return queueRepo.findAll(speakerId).map((i) => [i.title, i.position, i.status])
  }

  it('should number positions per speaker', () => {
    const { a, b, add } = setup()
    add(a, 'A1')
    add(b, 'B1')
    add(a, 'A2')
    add(b, 'B2')

    expect(snapshot(a)).toEqual([['A1', 0, 'pending'], ['A2', 1, 'pending']])
    expect(snapshot(b)).toEqual([['B1', 0, 'pending'], ['B2', 1, 'pending']])
  })

  it('should not shift other speakers when inserting at top or removing', () => {
    const { a, b, add } = setup()
    const a1 = add(a, 'A1')
    add(b, 'B1')
    add(b, 'B2')

    queueRepo.insertAtTop({ url: 'A0', title: 'A0', thumbnail: '', duration: 100, speaker_id: a })
    queueRepo.remove(a1.id)

    expect(snapshot(a)).toEqual([['A0', 0, 'pending']])
    expect(snapshot(b)).toEqual([['B1', 0, 'pending'], ['B2', 1, 'pending']])
  })

  it('should keep another speaker playing when marking an item as playing', () => {
    const { a, b, add } = setup()
    const a1 = add(a, 'A1')
    const b1 = add(b, 'B1')

    queueRepo.markPlaying(b1.id)
    queueRepo.markPlaying(a1.id)

    expect(queueRepo.findById(b1.id)!.status).toBe('playing')
    expect(queueRepo.findById(a1.id)!.status).toBe('playing')
  })

  it('should only pause and reset the given speaker', () => {
    const { a, b, add } = setup()
    const a1 = add(a, 'A1')
    const b1 = add(b, 'B1')
    queueRepo.markPlaying(a1.id)
    queueRepo.markPlaying(b1.id)

    queueRepo.pausePlaying(a, 30)
    expect(queueRepo.findById(a1.id)).toMatchObject({ status: 'paused', paused_position: 30 })
    expect(queueRepo.findById(b1.id)!.status).toBe('playing')

    queueRepo.markPlaying(a1.id)
    queueRepo.resetPlayingToPending(a)
    expect(queueRepo.findById(a1.id)!.status).toBe('pending')
    expect(queueRepo.findById(b1.id)!.status).toBe('playing')
  })

  it('should reorder within a speaker using per-speaker indexes', () => {
    const { a, b, add } = setup()
    add(b, 'B1')
    add(a, 'A1')
    add(b, 'B2')
    add(a, 'A2')
    const a3 = add(a, 'A3')

    // Frontend sends the index within the speaker's own list
    queueRepo.updatePosition(a3.id, 0)

    expect(snapshot(a)).toEqual([['A3', 0, 'pending'], ['A1', 1, 'pending'], ['A2', 2, 'pending']])
    expect(snapshot(b)).toEqual([['B1', 0, 'pending'], ['B2', 1, 'pending']])
  })

  it('should move to back without leaving gaps', () => {
    const { a, b, add } = setup()
    const a1 = add(a, 'A1')
    add(a, 'A2')
    add(b, 'B1')
    add(a, 'A3')

    queueRepo.moveToBack(a1.id)

    expect(snapshot(a)).toEqual([['A2', 0, 'pending'], ['A3', 1, 'pending'], ['A1', 2, 'pending']])
    expect(snapshot(b)).toEqual([['B1', 0, 'pending']])
  })

  it('should only clear and renumber the given speaker', () => {
    const { a, b, add } = setup()
    const a1 = add(a, 'A1')
    add(a, 'A2')
    add(b, 'B1')
    const b2 = add(b, 'B2')
    queueRepo.markPlaying(b2.id)
    queueRepo.markPlaying(a1.id)

    expect(queueRepo.clearPending(b)).toBe(1)

    expect(snapshot(b)).toEqual([['B2', 0, 'playing']])
    expect(snapshot(a)).toEqual([['A1', 0, 'playing'], ['A2', 1, 'pending']])
  })
})
