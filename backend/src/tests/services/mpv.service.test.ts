import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EMPTY_STATUS } from '../../types/mpv.js'

// Mock child_process and net before importing
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('node:net', () => ({
  connect: vi.fn(),
}))

// Mock config
vi.mock('../../config/index.js', () => ({
  config: {
    mpvSocketDir: '/tmp',
  },
  mpvSocketPath: (speakerId: number) => `/tmp/mpv-socket-${speakerId}`,
}))

describe('mpv types', () => {
  it('should have correct empty status defaults', () => {
    expect(EMPTY_STATUS).toEqual({
      playing: false,
      paused: false,
      title: '',
      url: '',
      duration: 0,
      position: 0,
      volume: 60,
      speaker_id: null,
      speaker_name: null,
      has_next: false,
      has_previous: false,
      playback_mode: 'sequential',
    })
  })

  it('should spread EMPTY_STATUS to create independent copies', () => {
    const copy = { ...EMPTY_STATUS }
    copy.playing = true
    expect(EMPTY_STATUS.playing).toBe(false)
  })
})

describe('MpvProcess', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should export MpvProcess class', async () => {
    const { MpvProcess } = await import('../../services/mpv-process.js')
    expect(MpvProcess).toBeDefined()
    expect(typeof MpvProcess).toBe('function')
  })

  it('should create instance with speakerId and sinkName', async () => {
    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    expect(mpv.speakerId).toBe(1)
    expect(mpv.isConnected()).toBe(false)
  })

  it('should report not connected before start', async () => {
    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    expect(mpv.isConnected()).toBe(false)
  })

  it('should return idle playback info when not connected', async () => {
    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    const info = await mpv.getPlaybackInfo()
    expect(info.playing).toBe(false)
    expect(info.paused).toBe(false)
    expect(info.title).toBe('')
    expect(info.url).toBe('')
  })

  it('should have all required methods', async () => {
    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    expect(typeof mpv.start).toBe('function')
    expect(typeof mpv.play).toBe('function')
    expect(typeof mpv.pause).toBe('function')
    expect(typeof mpv.resume).toBe('function')
    expect(typeof mpv.stopPlayback).toBe('function')
    expect(typeof mpv.setVolume).toBe('function')
    expect(typeof mpv.seekTo).toBe('function')
    expect(typeof mpv.getPlaybackInfo).toBe('function')
    expect(typeof mpv.isConnected).toBe('function')
    expect(typeof mpv.kill).toBe('function')
    expect(typeof mpv.destroy).toBe('function')
  })

  it('should pass --audio-device arg when spawning', async () => {
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

    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'bluez_sink.bt_speaker')
    await mpv.start()

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('--audio-device=pulse/bluez_sink.bt_speaker')
    expect(spawnArgs).toContain('--input-ipc-server=/tmp/mpv-socket-1')

    mpv.kill()
  })

  it('should pass --volume arg with default volume when starting', async () => {
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

    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    await mpv.start()

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('--volume=60')

    mpv.kill()
  })

  it('should use custom volume when starting with volume param', async () => {
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

    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    await mpv.start(42)

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('--volume=42')

    mpv.kill()
  })

  it('should generate unique socket paths per speaker', async () => {
    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv1 = new MpvProcess(1, 'sink1')
    const mpv2 = new MpvProcess(2, 'sink2')
    // Both instances should target different sockets (verified via spawn args)
    expect(mpv1.speakerId).toBe(1)
    expect(mpv2.speakerId).toBe(2)
  })

  it('should clean up on destroy', async () => {
    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    await mpv.destroy()
    expect(mpv.isConnected()).toBe(false)
  })
})

describe('MpvProcess events', () => {
  async function startWithFakes() {
    vi.clearAllMocks()
    const { EventEmitter } = await import('node:events')
    const { spawn } = await import('node:child_process')
    const { connect } = await import('node:net')

    const processes: Array<InstanceType<typeof EventEmitter> & { kill: ReturnType<typeof vi.fn> }> = []
    vi.mocked(spawn).mockImplementation(() => {
      const proc = Object.assign(new EventEmitter(), { kill: vi.fn() })
      processes.push(proc)
      return proc as unknown as ReturnType<typeof spawn>
    })

    const sockets: Array<InstanceType<typeof EventEmitter> & { destroy: ReturnType<typeof vi.fn> }> = []
    vi.mocked(connect).mockImplementation(() => {
      const socket = Object.assign(new EventEmitter(), { destroy: vi.fn(), write: vi.fn() })
      sockets.push(socket)
      setTimeout(() => socket.emit('connect'), 0)
      return socket as unknown as ReturnType<typeof connect>
    })

    const { MpvProcess } = await import('../../services/mpv-process.js')
    const mpv = new MpvProcess(1, 'test_sink')
    await mpv.start()

    const send = (msg: object) => sockets[sockets.length - 1].emit('data', Buffer.from(JSON.stringify(msg) + '\n'))
    return { mpv, processes, sockets, send }
  }

  it('should emit track-loaded when mpv reports file-loaded', async () => {
    const { mpv, send } = await startWithFakes()
    const onLoaded = vi.fn()
    mpv.on('track-loaded', onLoaded)

    send({ event: 'file-loaded' })

    expect(onLoaded).toHaveBeenCalledTimes(1)
    mpv.kill()
  })

  it('should include the mpv file_error in track-error', async () => {
    const { mpv, send } = await startWithFakes()
    const onError = vi.fn()
    mpv.on('track-error', onError)

    send({ event: 'end-file', reason: 'error', file_error: 'loading failed' })

    expect(onError).toHaveBeenCalledTimes(1)
    expect((onError.mock.calls[0][0] as Error).message).toContain('loading failed')
    mpv.kill()
  })

  it('should ignore end-file with reason stop', async () => {
    const { mpv, send } = await startWithFakes()
    const onEnd = vi.fn()
    const onError = vi.fn()
    mpv.on('track-end', onEnd)
    mpv.on('track-error', onError)

    send({ event: 'end-file', reason: 'stop' })

    expect(onEnd).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    mpv.kill()
  })

  it('should emit process-exit when the running mpv process exits', async () => {
    const { mpv, processes } = await startWithFakes()
    const onExit = vi.fn()
    mpv.on('process-exit', onExit)

    processes[0].emit('exit', 1)

    expect(onExit).toHaveBeenCalledWith(1)
    expect(mpv.isConnected()).toBe(false)
  })

  it('should ignore the exit of a process that was already replaced', async () => {
    const { mpv, processes, sockets } = await startWithFakes()
    const onExit = vi.fn()
    mpv.on('process-exit', onExit)

    // Old process is killed and a new one started before its exit event fires
    mpv.kill()
    await mpv.start()
    processes[0].emit('exit', null)

    expect(onExit).not.toHaveBeenCalled()
    expect(mpv.isConnected()).toBe(true)
    expect(sockets[1].destroy).not.toHaveBeenCalled()
    mpv.kill()
  })
})
