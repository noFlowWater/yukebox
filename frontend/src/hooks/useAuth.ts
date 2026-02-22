'use client'

import { useContext, createContext } from 'react'
import type { User } from '@/types'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
