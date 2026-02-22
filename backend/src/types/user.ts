export interface User {
  id: number
  username: string
  password_hash: string
  role: 'admin' | 'user'
  created_at: string
}

export interface UserPublic {
  id: number
  username: string
  role: 'admin' | 'user'
  created_at: string
}

export interface RefreshToken {
  id: number
  user_id: number
  token_hash: string
  expires_at: string
  created_at: string
}

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
  }
}
