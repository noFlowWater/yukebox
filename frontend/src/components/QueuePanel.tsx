'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ListMusic, GripVertical, Pause, Play, Square, Shuffle, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'
import { formatDuration, handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useStatus } from '@/contexts/StatusContext'
import type { QueueItem } from '@/types'

const POLL_INTERVAL = 3000

export function QueuePanel() {
  const { activeSpeakerId } = useSpeaker()
  const { status: playbackStatus } = useStatus()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
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

  // --- Shuffle ---
  const handleShuffle = useCallback(async () => {
    try {
      await api.shuffleQueue(activeSpeakerId)
      fetchQueue()
    } catch (err) {
      handleApiError(err, 'Shuffle failed')
    }
  }, [activeSpeakerId, fetchQueue])

  // --- Clear all pending ---
  const handleClearAll = useCallback(async () => {
    const prev = queue
    setQueue((q) => q.filter((item) => item.status === 'playing'))
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

  const hasPending = queue.some((item) => item.status === 'pending')

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-14 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ListMusic className="h-8 w-8 mb-2" />
        <p className="text-sm">Queue is empty</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      {/* Queue header */}
      <div className="flex items-center justify-end gap-1 py-2">
        {hasPending && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleClearAll}
            title="Clear pending"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear all
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShuffle}
          title="Shuffle queue"
        >
          <Shuffle className="h-4 w-4 mr-1.5" />
          Shuffle
        </Button>
      </div>

      <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1">
          {queue.map((item, index) => {
            const isActive = item.status === 'playing'
            const isPlaying = isActive && !playbackStatus.paused
            const isPaused = item.status === 'paused' || (isActive && playbackStatus.paused)

            return (
              <li
                key={item.id}
                draggable={!isPlaying && !isPaused}
                onDragStart={isPlaying || isPaused ? undefined : (e) => handleDragStart(e, index)}
                onDragOver={isPlaying || isPaused ? undefined : (e) => handleDragOver(e, index)}
                onDragLeave={isPlaying || isPaused ? undefined : handleDragLeave}
                onDrop={isPlaying || isPaused ? undefined : (e) => handleDrop(e, index)}
                onDragEnd={isPlaying || isPaused ? undefined : handleDragEnd}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors min-w-0 ${
                  isPlaying
                    ? 'bg-success/10 border border-success/30'
                    : isPaused
                      ? 'bg-warning/5 border border-warning/20'
                      : `cursor-grab active:cursor-grabbing hover:bg-muted/50 ${
                          dragIndex === index ? 'opacity-30' : ''
                        } ${
                          overIndex === index && dragIndex !== index
                            ? 'border-t-2 border-primary'
                            : 'border-t-2 border-transparent'
                        }`
                }`}
              >
                {/* Drag handle or status indicator */}
                {isPlaying ? (
                  <span className="inline-block w-4 h-4 shrink-0 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  </span>
                ) : isPaused ? (
                  <Pause className="h-4 w-4 text-warning shrink-0" />
                ) : (
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                )}

                {/* Thumbnail */}
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  width={56}
                  height={40}
                  className="h-10 w-14 rounded object-cover shrink-0 bg-muted pointer-events-none"
                />

                {/* Title + Duration/Status */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(item.duration)}
                    </p>
                    {isPlaying && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-success/20 text-success">
                        playing
                      </span>
                    )}
                    {isPaused && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-warning/20 text-warning">
                        paused
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions — playing item: pause + stop */}
                {isPlaying && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handlePause}
                      title="Pause"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={handleStop}
                      title="Stop"
                    >
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {/* Actions — paused item: resume + remove */}
                {isPaused && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handlePlay(item.id)}
                      title="Resume"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(item.id)}
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Actions — pending item: play + remove */}
                {!isPlaying && !isPaused && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handlePlay(item.id)}
                      title="Play now"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(item.id)}
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
