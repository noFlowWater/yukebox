import { useEffect, useState, useCallback } from 'react'
import { handleApiError } from '@/lib/utils'
import { getRelativeTime } from '@/lib/utils'
import * as api from '@/lib/api'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useStatus } from '@/contexts/StatusContext'
import { useAccessibility } from '@/contexts/AccessibilityContext'
import type { Schedule } from '@/types'

const POLL_INTERVAL = 3000

export function useSchedulePanel() {
  const { activeSpeakerId } = useSpeaker()
  const { status: playbackStatus } = useStatus()
  const { timezone } = useAccessibility()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [, setTick] = useState(0)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)

  const fetchSchedules = useCallback(async () => {
    try {
      const items = await api.getSchedules(activeSpeakerId)
      setSchedules(items)
    } catch {
      // silent on poll errors
    } finally {
      setIsLoading(false)
    }
  }, [activeSpeakerId])

  // Initial fetch + polling + listen for external updates
  useEffect(() => {
    fetchSchedules()
    const id = setInterval(fetchSchedules, POLL_INTERVAL)
    const onUpdate = () => fetchSchedules()
    window.addEventListener('schedule-updated', onUpdate)
    return () => {
      clearInterval(id)
      window.removeEventListener('schedule-updated', onUpdate)
    }
  }, [fetchSchedules])

  // Refresh relative times every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleDelete = useCallback(async (id: number) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
    try {
      await api.deleteSchedule(id)
    } catch (err) {
      handleApiError(err, 'Failed to delete schedule')
      fetchSchedules()
    }
  }, [fetchSchedules])

  const handleDeleteAll = useCallback(async () => {
    const prev = schedules
    setSchedules([])
    try {
      await api.deleteAllSchedules(activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Failed to clear schedules')
      setSchedules(prev)
    }
  }, [schedules, activeSpeakerId])

  const handleUpdateTime = useCallback(async (id: number, scheduledAt: string) => {
    try {
      const updated = await api.updateScheduleTime(id, scheduledAt)
      setSchedules((prev) => {
        const updatedIds = new Set(updated.map((u) => u.id))
        return prev.map((s) => {
          const match = updated.find((u) => u.id === s.id)
          return match ?? s
        }).filter((s) => updatedIds.has(s.id) || !updated.some((u) => u.id === s.id))
      })
      setEditingScheduleId(null)
      window.dispatchEvent(new Event('schedule-updated'))
    } catch (err) {
      handleApiError(err, 'Failed to update schedule time')
      fetchSchedules()
    }
  }, [fetchSchedules])

  const getEffectiveStatus = useCallback((schedule: Schedule) => {
    let effectiveStatus: string = schedule.status
    if (schedule.status === 'playing') {
      if (!playbackStatus.playing && !playbackStatus.paused) {
        effectiveStatus = 'completed'
      } else if (playbackStatus.paused) {
        effectiveStatus = 'paused'
      }
    }
    return effectiveStatus
  }, [playbackStatus])

  const getScheduleRelTime = useCallback((schedule: Schedule) => {
    return schedule.status === 'pending' ? getRelativeTime(schedule.scheduled_at) : null
  }, [])

  return {
    schedules,
    isLoading,
    editingScheduleId,
    timezone,
    setEditingScheduleId,
    handleDelete,
    handleDeleteAll,
    handleUpdateTime,
    getEffectiveStatus,
    getScheduleRelTime,
  }
}
