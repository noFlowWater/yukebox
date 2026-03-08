'use client'

import { ListMusic, Clock, Heart } from 'lucide-react'
import { useBottomSheet } from '@/hooks/useBottomSheet'

const TABS = [
  { id: 'queue', label: 'Queue', icon: ListMusic },
  { id: 'schedule', label: 'Schedule', icon: Clock },
  { id: 'favorites', label: 'Favorites', icon: Heart },
] as const

interface BottomSheetProps {
  activeTab: string
  onTabChange: (tab: string) => void
  children: React.ReactNode
}

export function BottomSheet({ activeTab, onTabChange, children }: BottomSheetProps) {
  const { sheetRef, handleRef, snap, isDragging, snapTo, handleHandlers } = useBottomSheet()

  const isExpanded = snap !== 'peek'

  return (
    <>
      {/* Backdrop — click outside to collapse */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => snapTo('peek')}
          aria-hidden="true"
        />
      )}
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col"
      style={{
        /* top is controlled by useBottomSheet — bottom: 0 ensures sheet always reaches viewport bottom */
        borderTopLeftRadius: '1.25rem',
        borderTopRightRadius: '1.25rem',
        background: 'hsl(var(--card) / 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
        borderTop: '1px solid hsl(var(--border) / 0.4)',
      }}
    >
      {/* ── Drag handle zone ── */}
      <div
        ref={handleRef}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
        {...handleHandlers}
      >
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center px-2 pb-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onTabChange(id)
                  if (snap === 'peek') snapTo('half')
                }}
                onDoubleClick={() => snapTo(isExpanded ? 'peek' : 'half')}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className={isActive ? '' : 'hidden sm:inline'}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div
        className={`flex-1 min-h-0 overflow-x-hidden px-4 pb-4 overscroll-contain ${
          isDragging ? 'pointer-events-none' : ''
        }`}
        style={{
          overflowY: snap === 'peek' ? 'hidden' : 'auto',
        }}
      >
        <div className="max-w-2xl mx-auto">
          {children}
        </div>
      </div>
    </div>
    </>
  )
}
