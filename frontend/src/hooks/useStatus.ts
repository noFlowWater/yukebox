'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { PlaybackStatus } from '@/types'
import { getStatusStreamUrl } from '@/lib/api'

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

export function useStatus() {
  const [status, setStatus] = useState<PlaybackStatus>(EMPTY_STATUS)
  const [connected, setConnected] = useState(false)
  const retriesRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(getStatusStreamUrl(), { withCredentials: true })
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
        timerRef.current = setTimeout(connect, RECONNECT_INTERVAL)
      }
    }
  }, [])

  useEffect(() => {
    connect()

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
  }, [connect])

  return { status, connected }
}
