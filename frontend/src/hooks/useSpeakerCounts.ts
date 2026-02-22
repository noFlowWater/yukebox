'use client'

import { useState, useEffect, useCallback } from 'react'
import * as api from '@/lib/api'

export function useSpeakerCounts(speakerId: number | null) {
  const [queueCount, setQueueCount] = useState(0)
  const [scheduleCount, setScheduleCount] = useState(0)

  const fetchCounts = useCallback(async () => {
    if (!speakerId) {
      setQueueCount(0)
      setScheduleCount(0)
      return
    }

    try {
      const [queueItems, schedules] = await Promise.all([
        api.getQueue(speakerId),
        api.getSchedules(speakerId),
      ])
      setQueueCount(queueItems.length)
      setScheduleCount(
        schedules.filter((s) => s.status === 'pending').length
      )
    } catch {
      // silent on fetch errors
    }
  }, [speakerId])

  useEffect(() => {
    fetchCounts()

    const onQueueUpdate = () => fetchCounts()
    const onScheduleUpdate = () => fetchCounts()

    window.addEventListener('queue-updated', onQueueUpdate)
    window.addEventListener('schedule-updated', onScheduleUpdate)

    return () => {
      window.removeEventListener('queue-updated', onQueueUpdate)
      window.removeEventListener('schedule-updated', onScheduleUpdate)
    }
  }, [fetchCounts])

  return { queueCount, scheduleCount }
}
