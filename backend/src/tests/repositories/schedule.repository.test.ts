import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../../repositories/db.js'
import * as scheduleRepo from '../../repositories/schedule.repository.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('schedule.repository', () => {
  it('should start with empty schedules', () => {
    const items = scheduleRepo.findAll()
    expect(items).toHaveLength(0)
  })

  it('should insert a schedule with url', () => {
    const schedule = scheduleRepo.insert({
      url: 'https://youtube.com/watch?v=abc',
      title: 'Morning Song',
      scheduled_at: '2026-03-01T07:00:00Z',
    })

    expect(schedule.id).toBe(1)
    expect(schedule.url).toBe('https://youtube.com/watch?v=abc')
    expect(schedule.status).toBe('pending')
  })

  it('should insert a schedule with query', () => {
    const schedule = scheduleRepo.insert({
      query: 'lofi hip hop',
      title: 'lofi hip hop',
      scheduled_at: '2026-03-01T07:00:00Z',
    })

    expect(schedule.query).toBe('lofi hip hop')
    expect(schedule.url).toBe('')
  })

  it('should find by id', () => {
    const inserted = scheduleRepo.insert({
      url: 'url1',
      title: 'Song',
      scheduled_at: '2026-03-01T07:00:00Z',
    })

    const found = scheduleRepo.findById(inserted.id)
    expect(found).toBeDefined()
    expect(found!.title).toBe('Song')
  })

  it('should return undefined for non-existent id', () => {
    const found = scheduleRepo.findById(999)
    expect(found).toBeUndefined()
  })

  it('should find pending schedules', () => {
    scheduleRepo.insert({ url: 'url1', title: 'Song 1', scheduled_at: '2026-03-01T07:00:00Z' })
    scheduleRepo.insert({ url: 'url2', title: 'Song 2', scheduled_at: '2026-03-01T08:00:00Z' })

    const item = scheduleRepo.findById(1)!
    scheduleRepo.updateStatus(item.id, 'completed')

    const pending = scheduleRepo.findPending()
    expect(pending).toHaveLength(1)
    expect(pending[0].title).toBe('Song 2')
  })

  it('should find due schedules', () => {
    scheduleRepo.insert({ url: 'url1', title: 'Past', scheduled_at: '2026-01-01T00:00:00Z' })
    scheduleRepo.insert({ url: 'url2', title: 'Future', scheduled_at: '2099-12-31T23:59:59Z' })

    const due = scheduleRepo.findDue('2026-06-01T00:00:00Z')
    expect(due).toHaveLength(1)
    expect(due[0].title).toBe('Past')
  })

  it('should update status', () => {
    const schedule = scheduleRepo.insert({
      url: 'url1',
      title: 'Song',
      scheduled_at: '2026-03-01T07:00:00Z',
    })

    const updated = scheduleRepo.updateStatus(schedule.id, 'completed')
    expect(updated).toBe(true)

    const found = scheduleRepo.findById(schedule.id)
    expect(found!.status).toBe('completed')
  })

  it('should remove a schedule', () => {
    const schedule = scheduleRepo.insert({
      url: 'url1',
      title: 'Song',
      scheduled_at: '2026-03-01T07:00:00Z',
    })

    const removed = scheduleRepo.remove(schedule.id)
    expect(removed).toBe(true)
    expect(scheduleRepo.findAll()).toHaveLength(0)
  })

  it('should return false when removing non-existent schedule', () => {
    const removed = scheduleRepo.remove(999)
    expect(removed).toBe(false)
  })

  it('should order by scheduled_at', () => {
    scheduleRepo.insert({ url: 'url2', title: 'Later', scheduled_at: '2026-03-01T09:00:00Z' })
    scheduleRepo.insert({ url: 'url1', title: 'Earlier', scheduled_at: '2026-03-01T07:00:00Z' })

    const all = scheduleRepo.findAll()
    expect(all[0].title).toBe('Earlier')
    expect(all[1].title).toBe('Later')
  })
})
