import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EMPTY_STATUS } from '../../types/mpv.js'

// Mock child_process and net before importing the service
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('node:net', () => ({
  connect: vi.fn(),
}))

// We test the MpvService class behavior through its exported singleton
// Since mpv won't be available in CI, we test the type definitions and status defaults

describe('mpv types', () => {
  it('should have correct empty status defaults', () => {
    expect(EMPTY_STATUS).toEqual({
      playing: false,
      paused: false,
      title: '',
      url: '',
      duration: 0,
      position: 0,
      volume: 100,
      speaker_id: null,
      speaker_name: null,
    })
  })

  it('should spread EMPTY_STATUS to create independent copies', () => {
    const copy = { ...EMPTY_STATUS }
    copy.playing = true
    expect(EMPTY_STATUS.playing).toBe(false)
  })
})

describe('mpvService', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should export a singleton instance', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    expect(mpvService).toBeDefined()
    expect(typeof mpvService.play).toBe('function')
    expect(typeof mpvService.pause).toBe('function')
    expect(typeof mpvService.stopPlayback).toBe('function')
    expect(typeof mpvService.setVolume).toBe('function')
    expect(typeof mpvService.getStatus).toBe('function')
    expect(typeof mpvService.start).toBe('function')
    expect(typeof mpvService.stop).toBe('function')
    expect(typeof mpvService.isConnected).toBe('function')
  })

  it('should report not connected before start', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    expect(mpvService.isConnected()).toBe(false)
  })

  it('should return empty status when not connected', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    const status = await mpvService.getStatus()
    expect(status).toEqual(EMPTY_STATUS)
  })

  it('should have setActiveSpeaker, getActiveSpeakerId, getActiveSpeakerName methods', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    expect(typeof mpvService.setActiveSpeaker).toBe('function')
    expect(typeof mpvService.getActiveSpeakerId).toBe('function')
    expect(typeof mpvService.getActiveSpeakerName).toBe('function')
  })

  it('should return null for active speaker before setting', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    expect(mpvService.getActiveSpeakerId()).toBeNull()
    expect(mpvService.getActiveSpeakerName()).toBeNull()
  })

  it('should store active speaker after setActiveSpeaker', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    mpvService.setActiveSpeaker(1, 'alsa_output.analog', 'Living Room')
    expect(mpvService.getActiveSpeakerId()).toBe(1)
    expect(mpvService.getActiveSpeakerName()).toBe('Living Room')
  })

  it('should include speaker fields in status when not connected', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    mpvService.setActiveSpeaker(2, 'bluez_sink.bt', 'Bedroom')
    const status = await mpvService.getStatus()
    expect(status.speaker_id).toBe(2)
    expect(status.speaker_name).toBe('Bedroom')
    expect(status.playing).toBe(false)
  })

  it('should preserve active speaker after stop', async () => {
    const { mpvService } = await import('../../services/mpv.service.js')
    mpvService.setActiveSpeaker(3, 'test_sink', 'Test Speaker')
    await mpvService.stop()
    expect(mpvService.getActiveSpeakerId()).toBe(3)
    expect(mpvService.getActiveSpeakerName()).toBe('Test Speaker')
  })

  it('should pass --audio-device arg when start is called with sinkName', async () => {
    vi.clearAllMocks()
    const { spawn } = await import('node:child_process')
    const mockProcess = {
      on: vi.fn(),
      kill: vi.fn(),
    }
    vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>)

    const { connect } = await import('node:net')
    const mockSocket = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'connect') setTimeout(cb, 5)
        return mockSocket
      }),
      destroy: vi.fn(),
      write: vi.fn(),
    }
    vi.mocked(connect).mockReturnValue(mockSocket as unknown as ReturnType<typeof connect>)

    const { mpvService } = await import('../../services/mpv.service.js')
    await mpvService.start('bluez_sink.bt_speaker')

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('--audio-device=pulse/bluez_sink.bt_speaker')

    // cleanup without rejecting pending (just kill process ref)
    vi.mocked(spawn).mockClear()
  })

  it('should not pass --audio-device arg when start is called without sinkName', async () => {
    vi.clearAllMocks()
    const { spawn } = await import('node:child_process')
    const mockProcess = {
      on: vi.fn(),
      kill: vi.fn(),
    }
    vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>)

    const { connect } = await import('node:net')
    const mockSocket = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'connect') setTimeout(cb, 5)
        return mockSocket
      }),
      destroy: vi.fn(),
      write: vi.fn(),
    }
    vi.mocked(connect).mockReturnValue(mockSocket as unknown as ReturnType<typeof connect>)

    const { mpvService } = await import('../../services/mpv.service.js')
    await mpvService.start()

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    const hasAudioDevice = spawnArgs.some((arg: string) => arg.startsWith('--audio-device='))
    expect(hasAudioDevice).toBe(false)
  })
})
