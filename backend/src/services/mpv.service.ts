import { spawn, type ChildProcess } from 'node:child_process'
import { connect, type Socket } from 'node:net'
import { EventEmitter } from 'node:events'
import { config } from '../config/index.js'
import { EMPTY_STATUS, type MpvStatus, type MpvIpcResponse } from '../types/mpv.js'

class MpvService extends EventEmitter {
  private process: ChildProcess | null = null
  private socket: Socket | null = null
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: (data: unknown) => void; reject: (err: Error) => void }>()
  private buffer = ''
  private connected = false
  private status: MpvStatus = { ...EMPTY_STATUS }
  private connectRetries = 0
  private maxConnectRetries = 20
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private sinkName: string | null = null
  private activeSpeakerId: number | null = null
  private activeSpeakerName: string | null = null
  private trackTitle: string | null = null

  async start(sinkName?: string): Promise<void> {
    if (this.process) return

    this.sinkName = sinkName ?? this.sinkName

    const args = [
      '--idle=yes',
      '--no-video',
      '--no-terminal',
      `--input-ipc-server=${config.mpvSocket}`,
    ]

    if (this.sinkName) {
      args.push(`--audio-device=pulse/${this.sinkName}`)
    }

    this.process = spawn('mpv', args, {
      stdio: 'ignore',
    })

    this.process.on('exit', (code) => {
      this.connected = false
      this.socket?.destroy()
      this.socket = null
      this.process = null
      this.emit('exit', code)
    })

    this.process.on('error', (err) => {
      this.emit('error', err)
    })

    await this.connectIpc()
  }

  async stop(): Promise<void> {
    this.cleanup()
  }

  private cleanup(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }

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
    this.status = { ...EMPTY_STATUS }
    this.trackTitle = null
    this.connectRetries = 0
    this.buffer = ''
  }

  private connectIpc(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tryConnect = () => {
        const socket = connect(config.mpvSocket)

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

    if (msg.event) {
      this.emit(msg.event, msg)

      if (msg.event === 'end-file') {
        this.status.playing = false
        this.status.paused = false
      }
    }
  }

  private observeProperties(): void {
    this.command('observe_property', 1, 'pause')
    this.command('observe_property', 2, 'media-title')
    this.command('observe_property', 3, 'duration')
    this.command('observe_property', 4, 'time-pos')
    this.command('observe_property', 5, 'volume')
    this.command('observe_property', 6, 'path')
    this.command('observe_property', 7, 'idle-active')
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
      await this.start(this.sinkName ?? undefined)
    }
    if (startPosition !== undefined && startPosition > 0) {
      await this.command('loadfile', url, 'replace', `start=${startPosition}`)
    } else {
      await this.command('loadfile', url, 'replace')
    }
    this.status.playing = true
    this.status.paused = false
    this.status.url = url
    this.trackTitle = title ?? null
  }

  async pause(): Promise<void> {
    const paused = await this.getProperty('pause')
    await this.setProperty('pause', !paused)
    this.status.paused = !paused
  }

  async resume(): Promise<void> {
    await this.setProperty('pause', false)
    this.status.paused = false
  }

  async stopPlayback(): Promise<void> {
    await this.command('stop')
    this.status.playing = false
    this.status.paused = false
    this.trackTitle = null
  }

  async setVolume(volume: number): Promise<void> {
    await this.setProperty('volume', volume)
    this.status.volume = volume
  }

  async seekTo(seconds: number): Promise<void> {
    await this.command('seek', seconds, 'absolute')
  }

  async getStatus(): Promise<MpvStatus> {
    if (!this.connected) {
      return { ...EMPTY_STATUS, speaker_id: this.activeSpeakerId, speaker_name: this.activeSpeakerName }
    }

    try {
      const [pause, title, duration, position, volume, path, idle] = await Promise.all([
        this.getProperty('pause').catch(() => false),
        this.getProperty('media-title').catch(() => ''),
        this.getProperty('duration').catch(() => 0),
        this.getProperty('time-pos').catch(() => 0),
        this.getProperty('volume').catch(() => 100),
        this.getProperty('path').catch(() => ''),
        this.getProperty('idle-active').catch(() => true),
      ])

      const isPlaying = !idle && !!path

      this.status = {
        playing: isPlaying,
        paused: pause as boolean,
        title: isPlaying ? (this.trackTitle || (title as string) || '') : '',
        url: isPlaying ? ((path as string) || '') : '',
        duration: isPlaying ? ((duration as number) || 0) : 0,
        position: isPlaying ? ((position as number) || 0) : 0,
        volume: (volume as number) || 100,
        speaker_id: this.activeSpeakerId,
        speaker_name: this.activeSpeakerName,
      }
    } catch {
      // return cached status on error
    }

    return { ...this.status }
  }

  private getProperty(name: string): Promise<unknown> {
    return this.command('get_property', name)
  }

  private setProperty(name: string, value: unknown): Promise<unknown> {
    return this.command('set_property', name, value)
  }

  setActiveSpeaker(speakerId: number, sinkName: string, displayName: string): void {
    this.activeSpeakerId = speakerId
    this.sinkName = sinkName
    this.activeSpeakerName = displayName
  }

  getActiveSpeakerId(): number | null {
    return this.activeSpeakerId
  }

  getActiveSpeakerName(): string | null {
    return this.activeSpeakerName
  }

  isConnected(): boolean {
    return this.connected
  }
}

export const mpvService = new MpvService()
