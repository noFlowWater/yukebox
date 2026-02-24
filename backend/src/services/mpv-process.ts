import { spawn, type ChildProcess } from 'node:child_process'
import { connect, type Socket } from 'node:net'
import { EventEmitter } from 'node:events'
import { mpvSocketPath } from '../config/index.js'
import type { MpvIpcResponse } from '../types/mpv.js'

export class MpvProcess extends EventEmitter {
  readonly speakerId: number
  private sinkName: string
  private socketPath: string
  private process: ChildProcess | null = null
  private socket: Socket | null = null
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: (data: unknown) => void; reject: (err: Error) => void }>()
  private buffer = ''
  private connected = false
  private connectRetries = 0
  private maxConnectRetries = 20
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private trackTitle: string | null = null
  private currentVolume = 60
  private destroyed = false

  constructor(speakerId: number, sinkName: string) {
    super()
    this.speakerId = speakerId
    this.sinkName = sinkName
    this.socketPath = mpvSocketPath(speakerId)
  }

  async start(volume?: number): Promise<void> {
    if (this.process || this.destroyed) return

    if (volume !== undefined) {
      this.currentVolume = volume
    }

    const args = [
      '--idle=yes',
      '--no-video',
      '--no-terminal',
      `--input-ipc-server=${this.socketPath}`,
      `--volume=${this.currentVolume}`,
      `--audio-device=pulse/${this.sinkName}`,
    ]

    this.process = spawn('mpv', args, {
      stdio: 'ignore',
    })

    this.process.on('exit', (code) => {
      this.connected = false
      this.socket?.destroy()
      this.socket = null
      this.process = null
      if (!this.destroyed) {
        this.emit('process-exit', code)
      }
    })

    this.process.on('error', (err) => {
      if (!this.destroyed) {
        this.emit('track-error', err)
      }
    })

    await this.connectIpc()
    this.startHealthCheck()
  }

  private connectIpc(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tryConnect = () => {
        if (this.destroyed) {
          reject(new Error('MpvProcess destroyed'))
          return
        }

        const socket = connect(this.socketPath)

        socket.on('connect', () => {
          this.socket = socket
          this.connected = true
          this.connectRetries = 0
          this.setupSocketListeners()
          this.observeProperties()
          resolve()
        })

        socket.on('error', () => {
          socket.destroy()
          this.connectRetries++

          if (this.connectRetries >= this.maxConnectRetries) {
            reject(new Error('Failed to connect to mpv IPC socket'))
            return
          }

          this.connectTimer = setTimeout(tryConnect, 100)
        })
      }

      tryConnect()
    })
  }

  private setupSocketListeners(): void {
    if (!this.socket) return

    this.socket.on('data', (data) => {
      this.buffer += data.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg: MpvIpcResponse = JSON.parse(line)
          this.handleMessage(msg)
        } catch {
          // ignore malformed JSON
        }
      }
    })

    this.socket.on('close', () => {
      this.connected = false
      this.socket = null
    })
  }

  private handleMessage(msg: MpvIpcResponse): void {
    if (msg.request_id !== undefined) {
      const pending = this.pendingRequests.get(msg.request_id)
      if (pending) {
        this.pendingRequests.delete(msg.request_id)
        if (msg.error && msg.error !== 'success') {
          pending.reject(new Error(msg.error))
        } else {
          pending.resolve(msg.data)
        }
      }
      return
    }

    if (msg.event === 'end-file') {
      if (msg.reason === 'eof') {
        this.emit('track-end')
      } else if (msg.reason === 'error') {
        this.emit('track-error', new Error('mpv playback error'))
      }
      // 'stop' reason = loadfile replace, ignore (not a real track end)
    }
  }

  private observeProperties(): void {
    // Fire-and-forget: observe_property commands are setup calls.
    // If mpv dies before they resolve, we don't need the results.
    this.command('observe_property', 1, 'pause').catch(() => {})
    this.command('observe_property', 2, 'media-title').catch(() => {})
    this.command('observe_property', 3, 'duration').catch(() => {})
    this.command('observe_property', 4, 'time-pos').catch(() => {})
    this.command('observe_property', 5, 'volume').catch(() => {})
    this.command('observe_property', 6, 'path').catch(() => {})
    this.command('observe_property', 7, 'idle-active').catch(() => {})
  }

  private command(...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('mpv not connected'))
        return
      }

      const id = ++this.requestId
      this.pendingRequests.set(id, { resolve, reject })

      const msg = JSON.stringify({ command: args, request_id: id }) + '\n'
      this.socket.write(msg)
    })
  }

  async play(url: string, title?: string, startPosition?: number): Promise<void> {
    if (!this.process) {
      await this.start()
    }

    if (startPosition !== undefined && startPosition > 0) {
      await this.command('loadfile', url, 'replace', `start=${startPosition}`)
    } else {
      await this.command('loadfile', url, 'replace')
    }

    // Reset pause state and apply volume on every new track
    await this.setProperty('pause', false)
    await this.setProperty('volume', this.currentVolume)
    this.trackTitle = title ?? null
  }

  async stopPlayback(): Promise<void> {
    try {
      await this.command('stop')
    } catch {
      // mpv may already be stopped
    }
    this.trackTitle = null
  }

  async pause(): Promise<void> {
    const paused = await this.getProperty('pause')
    await this.setProperty('pause', !paused)
  }

  async resume(): Promise<void> {
    await this.setProperty('pause', false)
  }

  async setVolume(volume: number): Promise<void> {
    this.currentVolume = volume
    try {
      await this.setProperty('volume', volume)
    } catch {
      // mpv may not be connected yet — volume stored for next start
    }
  }

  async seekTo(seconds: number): Promise<void> {
    await this.command('seek', seconds, 'absolute')
  }

  async getPlaybackInfo(): Promise<{
    playing: boolean
    paused: boolean
    title: string
    url: string
    duration: number
    position: number
    volume: number
  }> {
    if (!this.connected) {
      return {
        playing: false,
        paused: false,
        title: '',
        url: '',
        duration: 0,
        position: 0,
        volume: this.currentVolume,
      }
    }

    try {
      const [pause, title, duration, position, volume, path, idle] = await Promise.all([
        this.getProperty('pause').catch(() => false),
        this.getProperty('media-title').catch(() => ''),
        this.getProperty('duration').catch(() => 0),
        this.getProperty('time-pos').catch(() => 0),
        this.getProperty('volume').catch(() => this.currentVolume),
        this.getProperty('path').catch(() => ''),
        this.getProperty('idle-active').catch(() => true),
      ])

      const isPlaying = !idle && !!path

      return {
        playing: isPlaying,
        paused: pause as boolean,
        title: isPlaying ? (this.trackTitle || (title as string) || '') : '',
        url: isPlaying ? ((path as string) || '') : '',
        duration: isPlaying ? ((duration as number) || 0) : 0,
        position: isPlaying ? ((position as number) || 0) : 0,
        volume: (volume as number) || this.currentVolume,
      }
    } catch {
      return {
        playing: false,
        paused: false,
        title: '',
        url: '',
        duration: 0,
        position: 0,
        volume: this.currentVolume,
      }
    }
  }

  private getProperty(name: string): Promise<unknown> {
    return this.command('get_property', name)
  }

  private setProperty(name: string, value: unknown): Promise<unknown> {
    return this.command('set_property', name, value)
  }

  private startHealthCheck(): void {
    this.stopHealthCheck()
    this.healthTimer = setInterval(async () => {
      if (!this.connected || this.destroyed) return
      try {
        await Promise.race([
          this.getProperty('idle-active'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ])
      } catch {
        // IPC unresponsive — kill process
        this.kill()
        this.emit('process-exit', -1)
      }
    }, 10_000)
  }

  private stopHealthCheck(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  kill(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }

    this.stopHealthCheck()

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('mpv shutting down'))
    }
    this.pendingRequests.clear()

    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }

    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }

    this.connected = false
    this.trackTitle = null
    this.connectRetries = 0
    this.buffer = ''
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    this.kill()
    this.removeAllListeners()
  }
}
