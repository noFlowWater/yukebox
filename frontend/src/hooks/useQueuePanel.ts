import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useStatus } from '@/contexts/StatusContext'
import type { QueueItem as QueueItemType, PlaybackMode } from '@/types'

const POLL_INTERVAL = 3000

const MODES: PlaybackMode[] = ['sequential', 'repeat-all', 'repeat-one', 'shuffle']

export function useQueuePanel() {
  const { activeSpeakerId } = useSpeaker()
  const { status: playbackStatus } = useStatus()
  const [queue, setQueue] = useState<QueueItemType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('sequential')
  const suppressPollRef = useRef(false)

  const fetchQueue = useCallback(async () => {
    if (suppressPollRef.current) return
    try {
      const items = await api.getQueue(activeSpeakerId)
      setQueue(items)
    } catch {
      // silent on poll errors
    } finally {
      setIsLoading(false)
    }
  }, [activeSpeakerId])

  // Initial fetch + polling + listen for external updates
  useEffect(() => {
    fetchQueue()
    const id = setInterval(fetchQueue, POLL_INTERVAL)
    const onUpdate = () => fetchQueue()
    window.addEventListener('queue-updated', onUpdate)
    return () => {
      clearInterval(id)
      window.removeEventListener('queue-updated', onUpdate)
    }
  }, [fetchQueue])

  // Fetch playback mode when speaker changes
  useEffect(() => {
    async function fetchMode() {
      try {
        const { mode } = await api.getPlaybackMode(activeSpeakerId)
        setPlaybackMode(mode)
      } catch {
        // Fallback to sequential
      }
    }
    fetchMode()
  }, [activeSpeakerId])

  // --- Play from queue ---
  const handlePlay = useCallback(async (id: number) => {
    try {
      const item = await api.playFromQueue(id)
      toast.success(`Playing: ${item.title}`)
      fetchQueue()
    } catch (err) {
      handleApiError(err, 'Play failed')
    }
  }, [fetchQueue])

  // --- Pause (toggle) ---
  const handlePause = useCallback(async () => {
    try {
      await api.pause(activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Pause failed')
    }
  }, [activeSpeakerId])

  // --- Stop ---
  const handleStop = useCallback(async () => {
    try {
      await api.stop(activeSpeakerId)
      fetchQueue()
    } catch (err) {
      handleApiError(err, 'Stop failed')
    }
  }, [activeSpeakerId, fetchQueue])

  // --- Playback mode cycle ---
  const handleModeChange = useCallback(async () => {
    const nextIndex = (MODES.indexOf(playbackMode) + 1) % MODES.length
    const nextMode = MODES[nextIndex]
    setPlaybackMode(nextMode)
    try {
      await api.setPlaybackMode(nextMode, activeSpeakerId)
    } catch (err) {
      setPlaybackMode(playbackMode)
      handleApiError(err, 'Mode change failed')
    }
  }, [playbackMode, activeSpeakerId])

  // --- Clear all pending ---
  const handleClearAll = useCallback(async () => {
    const prev = queue
    setQueue((q) => q.filter((item) => item.status === 'playing' || item.status === 'paused'))
    try {
      await api.clearQueue(activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Clear failed')
      setQueue(prev)
    }
  }, [queue, activeSpeakerId])

  // --- Drag and Drop ---
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    suppressPollRef.current = true
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIndex(index)
  }, [])

  const handleDragLeave = useCallback(() => {
    setOverIndex(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    setOverIndex(null)

    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      suppressPollRef.current = false
      return
    }

    const item = queue[dragIndex]
    if (!item) {
      setDragIndex(null)
      suppressPollRef.current = false
      return
    }

    // Optimistic reorder
    const updated = [...queue]
    updated.splice(dragIndex, 1)
    updated.splice(targetIndex, 0, item)
    setQueue(updated)
    setDragIndex(null)

    try {
      await api.updateQueuePosition(item.id, targetIndex)
      await fetchQueue()
    } catch (err) {
      handleApiError(err, 'Reorder failed')
      await fetchQueue()
    } finally {
      suppressPollRef.current = false
    }
  }, [dragIndex, queue, fetchQueue])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setOverIndex(null)
    suppressPollRef.current = false
  }, [])

  // --- Remove ---
  const handleRemove = useCallback(async (id: number) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
    try {
      await api.removeFromQueue(id)
    } catch (err) {
      handleApiError(err, 'Remove failed')
      fetchQueue()
    }
  }, [fetchQueue])

  const hasPending = queue.some((item) => item.status === 'pending' || item.status === 'played')

  return {
    queue,
    isLoading,
    dragIndex,
    overIndex,
    playbackMode,
    playbackPaused: playbackStatus.paused,
    hasPending,
    handlePlay,
    handlePause,
    handleStop,
    handleModeChange,
    handleClearAll,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleRemove,
  }
}
