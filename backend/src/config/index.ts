export const config = {
  get port() { return Number(process.env.BACKEND_PORT) || 4000 },
  get nodeEnv() { return process.env.NODE_ENV || 'development' },
  get mpvSocketDir() { return process.env.MPV_SOCKET_DIR || '/tmp' },
  get dbPath() { return process.env.DB_PATH || './data/yukebox.db' },
  get frontendUrl() { return process.env.FRONTEND_URL || 'http://localhost:3000' },
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret && this.nodeEnv === 'production') {
      throw new Error('JWT_SECRET environment variable is required')
    }
    return secret || 'dev-secret-do-not-use-in-prod'
  },
  get bcryptRounds() { return 12 },
  get cookieSecure() { return this.nodeEnv === 'production' },
  get pulseServer() { return process.env.PULSE_SERVER || 'unix:/run/user/1000/pulse/native' },
}

export function mpvSocketPath(speakerId: number): string {
  return `${config.mpvSocketDir}/mpv-socket-${speakerId}`
}
