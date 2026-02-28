'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'
import type { User } from '@/types'

const ROLE_LABELS: Record<User['role'], string> = {
  admin: 'Admin',
  user: 'User',
}

export function useAdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (err) {
      handleApiError(err, 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleDelete(userId: number, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await api.deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      toast.success(`Deleted user: ${username}`)
    } catch (err) {
      handleApiError(err, 'Failed to delete user')
    }
  }

  async function handleRoleChange(userId: number, newRole: User['role']) {
    try {
      const updated = await api.updateUserRole(userId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`)
    } catch (err) {
      handleApiError(err, 'Failed to update role')
    }
  }

  return { users, loading, fetchUsers, handleDelete, handleRoleChange, ROLE_LABELS }
}
