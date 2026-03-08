import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStatus, EMPTY_STATUS } from '@/contexts/StatusContext'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { handleApiError } from '@/lib/utils'
import type { PlaybackStatus } from '@/types'
import * as api from '@/lib/api'

export function usePlayerBar() {
  const { status } = useStatus()
  const { activeSpeakerId } = useSpeaker()
  const [volumeLocal, setVolumeLocal] = useState<number | null>(null)
  const [seekLocal, setSeekLocal] = useState<number | null>(null)
  const [smoothPosition, setSmoothPosition] = useState(0)
  const sseSnapshotRef = useRef({ position: 0, time: Date.now() })

  // --- Hold previous track during natural transitions ---
  const [displayStatus, setDisplayStatus] = useState<PlaybackStatus>(EMPTY_STATUS)
  const lastActiveStatusRef = useRef<PlaybackStatus | null>(null)
  const userStoppedRef = useRef(false)

  useEffect(() => {
    const isActive = status.playing || status.paused

    if (isActive) {
      userStoppedRef.current = false
      lastActiveStatusRef.current = status
      setDisplayStatus(status)
      return
    }

    // User explicitly stopped — show idle immediately
    if (userStoppedRef.current) {
      lastActiveStatusRef.current = null
      setDisplayStatus(status)
      return
    }

    // Track ended naturally — hold previous display while backend has a next track
    if (lastActiveStatusRef.current && status.has_next) {
      return
    }

    // Nothing coming — show idle
    lastActiveStatusRef.current = null
    setDisplayStatus(status)
  }, [status])

  // --- Title fade on track change ---
  const [titleOpacity, setTitleOpacity] = useState(1)
  const prevTitleRef = useRef('')

  useEffect(() => {
    if (displayStatus.title && displayStatus.title !== prevTitleRef.current && prevTitleRef.current !== '') {
      setTitleOpacity(0)
      const timer = setTimeout(() => setTitleOpacity(1), 150)
      prevTitleRef.current = displayStatus.title
      return () => clearTimeout(timer)
    }
    prevTitleRef.current = displayStatus.title
  }, [displayStatus.title])

  // --- Marquee overflow detection ---
  const titleRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [titleOverflows, setTitleOverflows] = useState(false)

  useLayoutEffect(() => {
    const measure = measureRef.current
    const container = titleRef.current
    if (!measure || !container) return
    setTitleOverflows(measure.offsetWidth > container.clientWidth)
  }, [displayStatus.title])

  // Sync snapshot on every SSE update
  useLayoutEffect(() => {
    sseSnapshotRef.current = { position: status.position, time: Date.now() }
    setSmoothPosition(status.position)
  }, [status.position, status.url])

  // Interpolate between SSE ticks at ~60fps
  useEffect(() => {
    if (!status.playing || status.paused) return

    let raf: number
    const tick = () => {
      const elapsed = (Date.now() - sseSnapshotRef.current.time) / 1000
      const interpolated = sseSnapshotRef.current.position + elapsed
      setSmoothPosition(Math.min(interpolated, status.duration))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status.playing, status.paused, status.duration])

  const volume = volumeLocal ?? status.volume
  const position = seekLocal ?? smoothPosition

  const handlePause = useCallback(async () => {
    try {
      await api.pause(activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Pause failed')
    }
  }, [activeSpeakerId])

  const handleStop = useCallback(async () => {
    userStoppedRef.current = true
    try {
      await api.stop(activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Stop failed')
      userStoppedRef.current = false
    }
  }, [activeSpeakerId])

  const volumeTarget = useRef<number | null>(null)

  // Clear local override once SSE catches up
  useEffect(() => {
    if (volumeTarget.current !== null && Math.round(status.volume) === volumeTarget.current) {
      volumeTarget.current = null
      setVolumeLocal(null)
    }
  }, [status.volume])

  const handleVolumeDrag = useCallback((values: number[]) => {
    setVolumeLocal(values[0])
  }, [])

  const handleVolumeCommit = useCallback(async (values: number[]) => {
    const vol = values[0]
    setVolumeLocal(vol)
    volumeTarget.current = vol
    try {
      await api.setVolume(vol, activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Volume change failed')
      volumeTarget.current = null
      setVolumeLocal(null)
    }
  }, [activeSpeakerId])

  const seekTarget = useRef<number | null>(null)

  // Clear seek local once SSE position passes the target
  useEffect(() => {
    if (seekTarget.current !== null && Math.abs(status.position - seekTarget.current) < 3) {
      seekTarget.current = null
      setSeekLocal(null)
    }
  }, [status.position])

  const handleSeekDrag = useCallback((values: number[]) => {
    setSeekLocal(values[0])
  }, [])

  const handleSeekCommit = useCallback(async (values: number[]) => {
    const pos = values[0]
    setSeekLocal(pos)
    seekTarget.current = pos
    try {
      await api.seek(pos, activeSpeakerId)
    } catch (err) {
      handleApiError(err, 'Seek failed')
      seekTarget.current = null
      setSeekLocal(null)
    }
  }, [activeSpeakerId])

  const isIdle = !displayStatus.playing && !displayStatus.paused
  const showMarquee = displayStatus.playing && !displayStatus.paused && titleOverflows

  return {
    status,
    displayStatus,
    volume,
    position,
    titleOpacity,
    titleOverflows,
    isIdle,
    showMarquee,
    titleRef,
    measureRef,
    handlePause,
    handleStop,
    handleVolumeDrag,
    handleVolumeCommit,
    handleSeekDrag,
    handleSeekCommit,
  }
}
