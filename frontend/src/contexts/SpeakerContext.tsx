'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'
import type { Speaker } from '@/types'

const STORAGE_KEY = 'yukebox_speaker_id'

interface SpeakerContextValue {
  speakers: Speaker[]
  activeSpeakerId: number | null
  loadingSpeakers: boolean
  switchSpeaker: (id: number) => Promise<void>
  refreshSpeakers: () => Promise<void>
}

const SpeakerContext = createContext<SpeakerContextValue | null>(null)

export function useSpeaker(): SpeakerContextValue {
  const ctx = useContext(SpeakerContext)
  if (!ctx) {
    throw new Error('useSpeaker must be used within SpeakerProvider')
  }
  return ctx
}

export function SpeakerProvider({ children }: { children: React.ReactNode }) {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [activeSpeakerId, setActiveSpeakerId] = useState<number | null>(null)
  const [loadingSpeakers, setLoadingSpeakers] = useState(true)

  const resolveActiveSpeaker = useCallback((list: Speaker[]): number | null => {
    if (list.length === 0) return null

    // Check localStorage for stored speaker
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const storedId = Number(stored)
      if (list.some((s) => s.id === storedId)) {
        return storedId
      }
      // Stale — clear it
      localStorage.removeItem(STORAGE_KEY)
    }

    // Fallback: default speaker → first speaker
    const defaultSpeaker = list.find((s) => s.is_default)
    const fallback = defaultSpeaker ?? list[0]
    localStorage.setItem(STORAGE_KEY, String(fallback.id))
    return fallback.id
  }, [])

  const fetchSpeakers = useCallback(async () => {
    try {
      const list = await api.getSpeakers()
      setSpeakers(list)
      setActiveSpeakerId((prev) => {
        const resolved = resolveActiveSpeaker(list)
        // Only update if changed to avoid unnecessary re-renders
        return prev === resolved ? prev : resolved
      })
    } catch {
      // Speakers may not be available (e.g., not logged in yet)
    } finally {
      setLoadingSpeakers(false)
    }
  }, [resolveActiveSpeaker])

  useEffect(() => {
    fetchSpeakers()
  }, [fetchSpeakers])

  const switchSpeaker = useCallback(async (id: number) => {
    const previousId = activeSpeakerId

    // Optimistic update
    setActiveSpeakerId(id)
    localStorage.setItem(STORAGE_KEY, String(id))

    try {
      await api.activateSpeaker(id)
      const speaker = speakers.find((s) => s.id === id)
      toast.success(`Switched to ${speaker?.display_name ?? 'speaker'}`)
    } catch (err) {
      // Revert
      setActiveSpeakerId(previousId)
      if (previousId) {
        localStorage.setItem(STORAGE_KEY, String(previousId))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      handleApiError(err, 'Failed to switch speaker')
    }
  }, [activeSpeakerId, speakers])

  const refreshSpeakers = useCallback(async () => {
    try {
      const list = await api.getSpeakers()
      setSpeakers(list)
      setActiveSpeakerId((prev) => {
        // Re-validate current selection
        if (prev && list.some((s) => s.id === prev)) return prev
        return resolveActiveSpeaker(list)
      })
    } catch {
      // ignore
    }
  }, [resolveActiveSpeaker])

  return (
    <SpeakerContext.Provider
      value={{ speakers, activeSpeakerId, loadingSpeakers, switchSpeaker, refreshSpeakers }}
    >
      {children}
    </SpeakerContext.Provider>
  )
}
