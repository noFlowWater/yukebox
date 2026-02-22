import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'node:crypto'
import { config } from '../config/index.js'
import * as userRepo from '../repositories/user.repository.js'
import * as tokenRepo from '../repositories/token.repository.js'
import type { User, UserPublic } from '../types/user.js'
import { toPublicUser } from '../types/user.js'

const DUMMY_HASH = '$2a$12$LJ3m4ys3Lg2VBe8JFNqRaeQFr0baPRqxhJbHVMFfUVWBfEqB2nSYS'
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_DAYS = 7

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function register(
  username: string,
  password: string,
): Promise<UserPublic> {
  const normalizedUsername = username.toLowerCase()

  const existing = userRepo.findByUsername(normalizedUsername)
  if (existing) {
    throw new AuthError('USERNAME_TAKEN', 'Username is already taken')
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds)

  let role: 'admin' | 'user'
  if (userRepo.count() === 0) {
    role = 'admin'
  } else {
    role = 'user'
  }

  const user = userRepo.insert(normalizedUsername, passwordHash, role)
  return toPublicUser(user)
}

export function hasUsers(): boolean {
  return userRepo.count() > 0
}

export async function login(username: string, password: string): Promise<{
  user: UserPublic
  accessToken: string
  refreshToken: string
}> {
  tokenRepo.deleteExpired()

  const normalizedUsername = username.toLowerCase()
  const user = userRepo.findByUsername(normalizedUsername)

  // Always compare to prevent timing attacks
  const hashToCompare = user ? user.password_hash : DUMMY_HASH
  const valid = await bcrypt.compare(password, hashToCompare)

  if (!user || !valid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid username or password')
  }

  const accessToken = await signAccessToken(user)
  const refreshToken = await createRefreshToken(user.id)

  return { user: toPublicUser(user), accessToken, refreshToken }
}

export async function refresh(oldToken: string): Promise<{
  user: UserPublic
  accessToken: string
  refreshToken: string
}> {
  tokenRepo.deleteExpired()

  const oldHash = hashToken(oldToken)
  const stored = tokenRepo.findByTokenHash(oldHash)

  if (!stored) {
    throw new AuthError('INVALID_TOKEN', 'Invalid refresh token')
  }

  // Revoke old token
  tokenRepo.remove(stored.id)

  // Check expiry
  if (new Date(stored.expires_at) < new Date()) {
    throw new AuthError('TOKEN_EXPIRED', 'Refresh token has expired')
  }

  const user = userRepo.findById(stored.user_id)
  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found')
  }

  const accessToken = await signAccessToken(user)
  const refreshToken = await createRefreshToken(user.id)

  return { user: toPublicUser(user), accessToken, refreshToken }
}

export async function logout(refreshTokenValue: string): Promise<void> {
  const tokenHash = hashToken(refreshTokenValue)
  const stored = tokenRepo.findByTokenHash(tokenHash)
  if (stored) {
    tokenRepo.remove(stored.id)
  }
}

export async function verifyAccessToken(token: string): Promise<{ userId: number; role: string }> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return { userId: Number(payload.sub), role: payload.role as string }
  } catch {
    throw new AuthError('INVALID_TOKEN', 'Invalid or expired access token')
  }
}

async function signAccessToken(user: User): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getSecretKey())
}

async function createRefreshToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  tokenRepo.insert(userId, tokenHash, expiresAt)
  return token
}

export class AuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AuthError'
  }
}
