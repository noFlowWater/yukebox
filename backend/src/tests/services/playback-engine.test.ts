import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../../repositories/db.js'
import * as queueRepo from '../../repositories/queue.repository.js'
import * as speakerRepo from '../../repositories/speaker.repository.js'
import * as scheduleRepo from '../../repositories/schedule.repository.js'
import type { PlaybackMode } from '../../types/speaker.js'

const h = vi.hoisted(() => ({
  mpvInstances: [] as Array<import('node:events').EventEmitter & Record<string, ReturnType<typeof vi.fn>>>,
  unresolvable: new Set<string>(),
}))

vi.mock('../../services/mpv-process.js', async () => {
  const { EventEmitter } = await import('node:events')
  class FakeMpvProcess extends EventEmitter {
    play = vi.fn(async () => {})
    stopPlayback = vi.fn(async () => {})
    pause = vi.fn(async () => {})
    resume = vi.fn(async () => {})
    setVolume = vi.fn(async () => {})
    seekTo = vi.fn(async () => {})
    getPlaybackInfo = vi.fn(async () => ({
      playing: true, paused: false, title: '', url: '', duration: 100, position: 42, volume: 60,
    }))
    getCachedPlaybackInfo = vi.fn(() => ({
      playing: false, paused: false, title: '', url: '', duration: 0, position: 0, volume: 60,
    }))
    destroy = vi.fn(async () => {})
    constructor() {
      super()
      h.mpvInstances.push(this as never)
    }
  }
  return { MpvProcess: FakeMpvProcess }
})

vi.mock('../../services/ytdlp.service.js', () => ({
  resolve: vi.fn(async (url: string) => {
    if (h.unresolvable.has(url)) throw new Error('Failed to resolve URL: HTTP Error 403: Forbidden')
    return { url, title: `resolved ${url}`, thumbnail: '', duration: 100, audioUrl: `audio:${url}` }
  }),
  search: vi.fn(async () => []),
}))

const { PlaybackEngine, MAX_CONSECUTIVE_FAILURES } = await import('../../services/playback-engine.js')

let speakerId: number
let engine: InstanceType<typeof PlaybackEngine>
let mpv: (typeof h.mpvInstances)[number]

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  h.mpvInstances.length = 0
  h.unresolvable.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  speakerId = speakerRepo.insert('test_sink', 'Test Speaker').id
  engine = new PlaybackEngine(speakerId)
  mpv = h.mpvInstances[0]
})

afterEach(async () => {
  await engine.destroy()
  closeDb()
  delete process.env.DB_PATH
  vi.restoreAllMocks()
})

function setMode(mode: PlaybackMode): void {
  speakerRepo.updatePlaybackMode(speakerId, mode)
}

async function enqueue(...keys: string[]): Promise<number[]> {
  const ids: number[] = []
  for (const key of keys) {
    const item = await engine.addToQueue({ url: key, title: key, thumbnail: '', duration: 100 })
    ids.push(item.id)
  }
  return ids
}

function queueState(): Array<[string, string]> {
  return queueRepo.findAll(speakerId).map((i) => [i.url, i.status])
}

function statusOf(url: string): string | undefined {
  return queueRepo.findAll(speakerId).find((i) => i.url === url)?.status
}

// Wait until the engine has started the track and released its mutex, the way
// a real mpv error arrives only after the stream was requested
async function waitUntilPlaying(url: string): Promise<void> {
  await vi.waitFor(() => {
    expect(statusOf(url)).toBe('playing')
    expect(mpv.play).toHaveBeenLastCalledWith(`audio:${url}`, url, undefined)
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('PlaybackEngine — playback failures never delete queue items', () => {
  it('marks an unresolvable item as failed and advances to the next one', async () => {
    const [a] = await enqueue('A', 'B', 'C')
    h.unresolvable.add('B')

    await engine.playFromQueue(a)
    mpv.emit('track-end')

    await vi.waitFor(() => expect(statusOf('C')).toBe('playing'))
    expect(queueState()).toEqual([['A', 'played'], ['B', 'failed'], ['C', 'playing']])
    expect(mpv.play).toHaveBeenLastCalledWith('audio:C', 'C', undefined)
  })

  it('marks the current item as failed when mpv reports a playback error', async () => {
    const [a] = await enqueue('A', 'B')

    await engine.playFromQueue(a)
    mpv.emit('track-error', new Error('mpv playback error: loading failed'))

    await vi.waitFor(() => expect(statusOf('B')).toBe('playing'))
    expect(queueState()).toEqual([['A', 'failed'], ['B', 'playing']])
  })

  it('marks the current item as failed when the mpv process exits', async () => {
    const [a] = await enqueue('A', 'B')

    await engine.playFromQueue(a)
    mpv.emit('process-exit', 1)

    await vi.waitFor(() => expect(statusOf('B')).toBe('playing'))
    expect(statusOf('A')).toBe('failed')
  })

  it(`stops after ${MAX_CONSECUTIVE_FAILURES} consecutive failures and leaves the rest pending`, async () => {
    const [a] = await enqueue('A', 'B', 'C', 'D', 'E')
    h.unresolvable.add('B').add('C').add('D')

    await engine.playFromQueue(a)
    mpv.emit('track-end')

    await vi.waitFor(() => expect(statusOf('D')).toBe('failed'))
    expect(queueState()).toEqual([
      ['A', 'played'], ['B', 'failed'], ['C', 'failed'], ['D', 'failed'], ['E', 'pending'],
    ])
    expect(engine.getStatus().playing).toBe(false)
    expect(mpv.play).toHaveBeenCalledTimes(1)
  })

  it('counts asynchronous mpv errors toward the consecutive failure limit', async () => {
    const [a] = await enqueue('A', 'B', 'C', 'D')

    await engine.playFromQueue(a)
    mpv.emit('track-error', new Error('403'))
    await waitUntilPlaying('B')
    mpv.emit('track-error', new Error('403'))
    await waitUntilPlaying('C')
    mpv.emit('track-error', new Error('403'))

    await vi.waitFor(() => expect(statusOf('C')).toBe('failed'))
    expect(statusOf('D')).toBe('pending')
    expect(engine.getStatus().playing).toBe(false)
  })

  it('resets the failure count once a track loads successfully', async () => {
    const [a] = await enqueue('A', 'B', 'C', 'D', 'E')

    await engine.playFromQueue(a)
    mpv.emit('track-error', new Error('403'))
    await waitUntilPlaying('B')
    mpv.emit('track-error', new Error('403'))
    await waitUntilPlaying('C')

    mpv.emit('track-loaded')
    mpv.emit('track-error', new Error('403'))

    // Without the reset this third error would hit the limit and stop playback
    await vi.waitFor(() => expect(statusOf('D')).toBe('playing'))
  })

  it('ends the cycle instead of looping when the last item fails in sequential mode', async () => {
    const [a] = await enqueue('A', 'B')
    h.unresolvable.add('B')

    await engine.playFromQueue(a)
    mpv.emit('track-end')

    await vi.waitFor(() => expect(statusOf('B')).toBe('failed'))
    await vi.waitFor(() => expect(statusOf('A')).toBe('pending'))
    expect(engine.getStatus().playing).toBe(false)
    expect(mpv.play).toHaveBeenCalledTimes(1)
  })

  it('skips failed items on later auto-advance', async () => {
    const [a, b] = await enqueue('A', 'B', 'C')
    queueRepo.markFailed(b)

    await engine.playFromQueue(a)
    mpv.emit('track-end')

    await vi.waitFor(() => expect(statusOf('C')).toBe('playing'))
    expect(statusOf('B')).toBe('failed')
  })

  it('keeps failed items in shuffle mode and continues with another pending item', async () => {
    setMode('shuffle')
    const [a] = await enqueue('A', 'B', 'C')
    h.unresolvable.add('B').add('C')

    await engine.playFromQueue(a)
    mpv.emit('track-end')

    await vi.waitFor(() => expect(statusOf('C')).toBe('failed'))
    await vi.waitFor(() => expect(statusOf('B')).toBe('failed'))
    expect(queueRepo.findAll(speakerId)).toHaveLength(3)
  })

  it('marks a failing repeat-one replay as failed and moves on', async () => {
    setMode('repeat-one')
    const [a] = await enqueue('A', 'B')

    await engine.playFromQueue(a)
    h.unresolvable.add('A')
    mpv.emit('track-end')

    await vi.waitFor(() => expect(statusOf('B')).toBe('playing'))
    expect(statusOf('A')).toBe('failed')
  })
})

describe('PlaybackEngine — explicit play requests', () => {
  it('keeps the current track playing when a queued item fails to resolve', async () => {
    const [a, b] = await enqueue('A', 'B', 'C')
    h.unresolvable.add('B')

    await engine.playFromQueue(a)
    await expect(engine.playFromQueue(b)).rejects.toThrow('403')

    expect(queueState()).toEqual([['A', 'playing'], ['B', 'failed'], ['C', 'pending']])
    expect(mpv.play).toHaveBeenCalledTimes(1)
  })

  it('can retry a failed item', async () => {
    const [, b] = await enqueue('A', 'B')
    h.unresolvable.add('B')
    await expect(engine.playFromQueue(b)).rejects.toThrow()

    h.unresolvable.clear()
    await engine.playFromQueue(b)

    expect(statusOf('B')).toBe('playing')
    expect(queueRepo.findAll(speakerId)).toHaveLength(2)
  })

  it('marks the item failed when mpv refuses to load it', async () => {
    const [a] = await enqueue('A')
    mpv.play.mockRejectedValueOnce(new Error('mpv not connected'))

    await expect(engine.playFromQueue(a)).rejects.toThrow('mpv not connected')

    expect(statusOf('A')).toBe('failed')
  })

  it('plays the resolved audio stream instead of the page URL', async () => {
    await engine.playNow({ url: 'https://youtu.be/x', title: 'Song', thumbnail: 't', duration: 5 })

    expect(mpv.play).toHaveBeenCalledWith('audio:https://youtu.be/x', 'Song', undefined)
    expect(queueRepo.findAll(speakerId)[0]).toMatchObject({ title: 'Song', thumbnail: 't', status: 'playing' })
  })

  it('does not interrupt current playback when playNow cannot resolve', async () => {
    const [a] = await enqueue('A')
    await engine.playFromQueue(a)
    h.unresolvable.add('https://youtu.be/bad')

    await expect(engine.playNow({ url: 'https://youtu.be/bad', title: 'Bad' })).rejects.toThrow('403')

    expect(queueState()).toEqual([['A', 'playing']])
    expect(mpv.play).toHaveBeenCalledTimes(1)
  })

  it('clears failed items along with pending ones', async () => {
    const [a, b] = await enqueue('A', 'B', 'C')
    queueRepo.markFailed(b)
    await engine.playFromQueue(a)

    expect(engine.clearQueue()).toBe(2)
    expect(queueState()).toEqual([['A', 'playing']])
  })
})

describe('PlaybackEngine — schedules', () => {
  function insertSchedule(url: string, groupId: string | null = null) {
    return scheduleRepo.insert({
      url, title: url, scheduled_at: new Date().toISOString(), group_id: groupId, speaker_id: speakerId,
    })
  }

  function toTrigger(s: ReturnType<typeof insertSchedule>) {
    return {
      id: s.id, url: s.url, query: s.query, title: s.title,
      thumbnail: s.thumbnail, duration: s.duration, group_id: s.group_id,
    }
  }

  it('leaves current playback alone when a schedule cannot be resolved', async () => {
    const [a] = await enqueue('A')
    await engine.playFromQueue(a)
    const schedule = insertSchedule('S')
    h.unresolvable.add('S')

    await engine.triggerSchedule(toTrigger(schedule))

    expect(scheduleRepo.findById(schedule.id)!.status).toBe('failed')
    expect(queueState()).toEqual([['A', 'playing']])
    expect(mpv.play).toHaveBeenCalledTimes(1)
  })

  it('keeps a schedule item that fails in mpv and resumes the interrupted track', async () => {
    const [a] = await enqueue('A')
    await engine.playFromQueue(a)
    const schedule = insertSchedule('S')

    await engine.triggerSchedule(toTrigger(schedule))
    mpv.emit('track-error', new Error('403'))

    await vi.waitFor(() => expect(statusOf('A')).toBe('playing'))
    expect(statusOf('S')).toBe('failed')
    expect(scheduleRepo.findById(schedule.id)!.status).toBe('failed')
    expect(mpv.play).toHaveBeenLastCalledWith('audio:A', 'A', 42)
  })

  it('continues a schedule group without deadlocking the engine', async () => {
    const first = insertSchedule('S1', 'g1')
    const second = insertSchedule('S2', 'g1')

    await engine.triggerSchedule(toTrigger(first))
    mpv.emit('track-end')

    await vi.waitFor(() => expect(scheduleRepo.findById(second.id)!.status).toBe('playing'))
    expect(scheduleRepo.findById(first.id)!.status).toBe('completed')

    // A deadlocked mutex would make every later command hang forever
    await expect(engine.stop()).resolves.toBeUndefined()
  })

  it('falls back to the queue when the next group schedule cannot be resolved', async () => {
    await enqueue('A')
    const first = insertSchedule('S1', 'g1')
    const second = insertSchedule('S2', 'g1')
    h.unresolvable.add('S2')

    await engine.triggerSchedule(toTrigger(first))
    mpv.emit('track-end')

    await vi.waitFor(() => expect(statusOf('A')).toBe('playing'))
    expect(scheduleRepo.findById(second.id)!.status).toBe('failed')
  })
})
