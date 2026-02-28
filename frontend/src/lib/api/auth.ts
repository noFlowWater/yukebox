import { request } from './client'
import type { User } from '@/types'

// --- Auth ---

export function getSetupStatus() {
  return request<{ hasUsers: boolean }>('/api/auth/setup-status')
}

export function register(username: string, password: string) {
  return request<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function login(username: string, password: string) {
  return request<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return request<{ loggedOut: boolean }>('/api/auth/logout', {
    method: 'POST',
  })
}

export function getMe() {
  return request<User>('/api/auth/me')
}

// --- Admin ---

export function getUsers() {
  return request<User[]>('/api/admin/users')
}

export function deleteUser(id: number) {
  return request<{ removed: boolean }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  })
}

export function updateUserRole(id: number, role: 'admin' | 'user') {
  return request<User>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}
