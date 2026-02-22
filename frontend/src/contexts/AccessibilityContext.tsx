'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'yukebox_accessibility'

type Theme = 'dark' | 'light' | 'system'
type TextScale = 'default' | 'large' | 'x-large'

interface AccessibilitySettings {
  theme: Theme
  textScale: TextScale
  reduceMotion: boolean
  highContrast: boolean
  textWrap: boolean
  timezone: string
  searchResultCount: number
}

interface AccessibilityContextValue extends AccessibilitySettings {
  updateSettings: (partial: Partial<AccessibilitySettings>) => void
}

const defaults: AccessibilitySettings = {
  theme: 'dark',
  textScale: 'default',
  reduceMotion: false,
  highContrast: false,
  textWrap: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  searchResultCount: 5,
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return ctx
}

function loadSettings(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...defaults, ...parsed }
    }
  } catch {
    // ignore parse errors
  }
  return defaults
}

function applyToDOM(settings: AccessibilitySettings, resolvedTheme: 'dark' | 'light') {
  const root = document.documentElement

  // Theme class
  root.classList.remove('dark', 'light')
  root.classList.add(resolvedTheme)

  // Text scale
  if (settings.textScale === 'default') {
    root.removeAttribute('data-text-scale')
  } else {
    root.setAttribute('data-text-scale', settings.textScale)
  }

  // Reduced motion
  root.setAttribute('data-reduce-motion', String(settings.reduceMotion))

  // High contrast
  root.setAttribute('data-high-contrast', String(settings.highContrast))

  // Text wrap
  root.setAttribute('data-text-wrap', String(settings.textWrap))
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaults)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    applyToDOM(loaded, resolveTheme(loaded.theme))
    setMounted(true)
  }, [])

  // Listen for system theme changes when theme === 'system'
  useEffect(() => {
    if (!mounted || settings.theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyToDOM(settings, resolveTheme('system'))
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mounted, settings])

  const updateSettings = useCallback((partial: Partial<AccessibilitySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      applyToDOM(next, resolveTheme(next.theme))
      return next
    })
  }, [])

  return (
    <AccessibilityContext.Provider
      value={{ ...settings, updateSettings }}
    >
      {children}
    </AccessibilityContext.Provider>
  )
}
