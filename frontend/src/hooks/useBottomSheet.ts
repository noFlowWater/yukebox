import { useCallback, useEffect, useRef, useState } from 'react'

export type SheetSnap = 'peek' | 'half' | 'full'

const PEEK_HEIGHT = 148   // handle + tabs + ~1.5 items visible
const VELOCITY_THRESHOLD = 0.4  // px/ms — fast flick snaps to next level
const DRAG_THRESHOLD = 8        // px before we start dragging

interface UseBottomSheetOptions {
  defaultSnap?: SheetSnap
}

function getTop(snap: SheetSnap, vh: number): number {
  switch (snap) {
    case 'peek': return vh - PEEK_HEIGHT
    case 'half': return vh * 0.42
    case 'full': return vh * 0.08
  }
}

function nearestSnap(top: number, vh: number): SheetSnap {
  const peekTop = getTop('peek', vh)
  const halfTop = getTop('half', vh)
  const fullTop = getTop('full', vh)

  const dPeek = Math.abs(top - peekTop)
  const dHalf = Math.abs(top - halfTop)
  const dFull = Math.abs(top - fullTop)

  if (dPeek <= dHalf && dPeek <= dFull) return 'peek'
  if (dHalf <= dFull) return 'half'
  return 'full'
}

export function useBottomSheet({ defaultSnap = 'peek' }: UseBottomSheetOptions = {}) {
  const [snap, setSnap] = useState<SheetSnap>(defaultSnap)
  const [isDragging, setIsDragging] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const currentTop = useRef(0)
  const startY = useRef(0)
  const startTop = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)
  const velocity = useRef(0)
  const dragStarted = useRef(false)
  const pointerDown = useRef(false)
  const activePointerId = useRef<number | null>(null)
  const vh = useRef(0)

  const applyTop = useCallback((top: number, transition?: string) => {
    const el = sheetRef.current
    if (!el) return
    if (transition) {
      el.style.transition = transition
    } else {
      el.style.transition = 'none'
    }
    el.style.top = `${top}px`
    currentTop.current = top
  }, [])

  // Set initial position
  useEffect(() => {
    vh.current = window.innerHeight
    applyTop(getTop(snap, vh.current))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle resize
  useEffect(() => {
    const onResize = () => {
      vh.current = window.innerHeight
      applyTop(getTop(snap, vh.current))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [snap, applyTop])

  const animateTo = useCallback((targetSnap: SheetSnap) => {
    const top = getTop(targetSnap, vh.current)
    applyTop(top, 'top 0.35s cubic-bezier(0.32, 0.72, 0, 1)')
    setSnap(targetSnap)
    setIsDragging(false)
  }, [applyTop])

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (!sheetRef.current) return

    vh.current = window.innerHeight
    startY.current = e.clientY
    startTop.current = currentTop.current
    lastY.current = e.clientY
    lastTime.current = e.timeStamp
    velocity.current = 0
    dragStarted.current = false
    pointerDown.current = true
    activePointerId.current = e.pointerId

    sheetRef.current.style.transition = 'none'
  }, [])

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDown.current || activePointerId.current !== e.pointerId) return

    const dy = e.clientY - startY.current

    if (!dragStarted.current) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return
      dragStarted.current = true
      setIsDragging(true)
      handleRef.current?.setPointerCapture(e.pointerId)
    }

    const dt = e.timeStamp - lastTime.current
    if (dt > 0) {
      velocity.current = (e.clientY - lastY.current) / dt
    }
    lastY.current = e.clientY
    lastTime.current = e.timeStamp

    const newTop = startTop.current + dy
    const minTop = getTop('full', vh.current) - 30
    const maxTop = getTop('peek', vh.current) + 30
    const clamped = Math.max(minTop, Math.min(maxTop, newTop))

    applyTop(clamped)
  }, [applyTop])

  const onHandlePointerUp = useCallback((e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return

    if (handleRef.current?.hasPointerCapture(e.pointerId)) {
      handleRef.current.releasePointerCapture(e.pointerId)
    }

    pointerDown.current = false
    activePointerId.current = null

    if (!dragStarted.current) {
      setIsDragging(false)
      return
    }

    const v = velocity.current
    let targetSnap: SheetSnap

    if (Math.abs(v) > VELOCITY_THRESHOLD) {
      if (v > 0) {
        targetSnap = snap === 'full' ? 'half' : 'peek'
      } else {
        targetSnap = snap === 'peek' ? 'half' : 'full'
      }
    } else {
      targetSnap = nearestSnap(currentTop.current, vh.current)
    }

    animateTo(targetSnap)
  }, [snap, animateTo])

  const snapTo = useCallback((target: SheetSnap) => {
    animateTo(target)
  }, [animateTo])

  return {
    sheetRef,
    handleRef,
    snap,
    isDragging,
    snapTo,
    handleHandlers: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: onHandlePointerUp,
    },
  }
}
