import * as queueRepo from '../repositories/queue.repository.js'
import type { QueueItem, CreateQueueItem } from '../types/queue.js'

export class QueueManager {
  readonly speakerId: number
  private items: QueueItem[] = []

  constructor(speakerId: number) {
    this.speakerId = speakerId
  }

  front(): QueueItem | null {
    return this.items.length > 0 ? this.items[0] : null
  }

  insertAtFront(item: Omit<CreateQueueItem, 'speaker_id'>): QueueItem {
    const created = queueRepo.insertAtTop({
      ...item,
      speaker_id: this.speakerId,
    })
    this.reload()
    return created
  }

  append(item: Omit<CreateQueueItem, 'speaker_id'>): QueueItem {
    const created = queueRepo.insert({
      ...item,
      speaker_id: this.speakerId,
    })
    this.reload()
    return created
  }

  appendBulk(items: Omit<CreateQueueItem, 'speaker_id'>[]): QueueItem[] {
    const created: QueueItem[] = []
    for (const item of items) {
      const qi = queueRepo.insert({
        ...item,
        speaker_id: this.speakerId,
      })
      created.push(qi)
    }
    this.reload()
    return created
  }

  removeFront(): QueueItem | null {
    const front = this.front()
    if (!front) return null
    queueRepo.remove(front.id)
    this.reload()
    return front
  }

  remove(id: number): boolean {
    const result = queueRepo.remove(id)
    if (result) this.reload()
    return result
  }

  moveToFront(id: number): QueueItem | null {
    const item = this.items.find((i) => i.id === id)
    if (!item) return null

    // Remove from current position
    queueRepo.remove(id)

    // Re-insert at top with same metadata
    const created = queueRepo.insertAtTop({
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration,
      speaker_id: this.speakerId,
      schedule_id: item.schedule_id,
    })

    this.reload()
    return created
  }

  reorder(id: number, newPos: number): boolean {
    const result = queueRepo.updatePosition(id, newPos)
    if (result) this.reload()
    return result
  }

  shuffle(): void {
    queueRepo.shuffle(this.speakerId)
    this.reload()
  }

  clearPending(): number {
    const count = queueRepo.clearPending(this.speakerId)
    this.reload()
    return count
  }

  markPlaying(id: number): boolean {
    const result = queueRepo.markPlaying(id)
    if (result) this.reload()
    return result
  }

  pauseFront(position: number): void {
    queueRepo.pausePlaying(position)
    this.reload()
  }

  removePlaying(): void {
    queueRepo.removePlaying()
    this.reload()
  }

  getAll(): QueueItem[] {
    return [...this.items]
  }

  findPaused(): QueueItem | null {
    return this.items.find((i) => i.status === 'paused') ?? null
  }

  findFirstPending(): QueueItem | null {
    return this.items.find((i) => i.status === 'pending') ?? null
  }

  findNextPlayable(): QueueItem | null {
    // First check for paused items (resume interrupted playback)
    const paused = this.findPaused()
    if (paused) return paused

    // Then check for pending items
    return this.findFirstPending()
  }

  reload(): void {
    this.items = queueRepo.findAllBySpeaker(this.speakerId)
  }

  static load(speakerId: number): QueueManager {
    const manager = new QueueManager(speakerId)

    // Reset any 'playing' items to 'pending' on startup (server restart recovery)
    queueRepo.resetPlayingToPending()

    manager.reload()
    return manager
  }
}
