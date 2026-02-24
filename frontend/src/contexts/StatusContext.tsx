'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import type { PlaybackStatus } from '@/types'
import { getStatusStreamUrl } from '@/lib/api'
import { useSpeaker } from '@/contexts/SpeakerContext'

const RECONNECT_INTERVAL = 3000
const MAX_RETRIES = 10

export const EMPTY_STATUS: PlaybackStatus = {
  playing: false,
  paused: false,
  title: '',
  url: '',
  duration: 0,
  position: 0,
  volume: 0,
  speaker_id: null,
  speaker_name: null,
  has_next: false,
}

interface StatusContextValue {
  status: PlaybackStatus
  connected: boolean
}

const StatusContext = createContext<StatusContextValue | null>(null)

export function useStatus(): StatusContextValue {
  const ctx = useContext(StatusContext)
  if (!ctx) {
    throw new Error('useStatus must be used within StatusProvider')
  }
  return ctx
}

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const { activeSpeakerId } = useSpeaker()
  const [status, setStatus] = useState<PlaybackStatus>(EMPTY_STATUS)
  const [connected, setConnected] = useState(false)
  const retriesRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback((speakerId: number | null) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const url = getStatusStreamUrl(speakerId)
    const es = new EventSource(url, { withCredentials: true })
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
      retriesRef.current = 0
    }

    es.onmessage = (event) => {
      try {
        const data: PlaybackStatus = JSON.parse(event.data)
        setStatus(data)
      } catch {
        // ignore malformed messages
      }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setConnected(false)

      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1
        timerRef.current = setTimeout(() => connect(speakerId), RECONNECT_INTERVAL)
      }
    }
  }, [])

  // Reconnect SSE when active speaker changes
  useEffect(() => {
    retriesRef.current = 0
    connect(activeSpeakerId)

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [activeSpeakerId, connect])

  return (
    <StatusContext.Provider value={{ status, connected }}>
      {children}
    </StatusContext.Provider>
  )
}
