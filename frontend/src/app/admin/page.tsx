'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useSpeaker } from '@/contexts/SpeakerContext'
import { useAdminUsers } from './_hooks/useAdminUsers'
import { useAdminSettings } from './_hooks/useAdminSettings'
import { useAdminSpeakers } from './_hooks/useAdminSpeakers'
import { useAdminBluetooth } from './_hooks/useAdminBluetooth'
import { SettingsSection } from './_sections/SettingsSection'
import { UsersSection } from './_sections/UsersSection'
import { SpeakersSection } from './_sections/SpeakersSection'
import { BluetoothSection } from './_sections/BluetoothSection'

export default function AdminPage() {
  const router = useRouter()
  const { user: currentUser, loading: authLoading } = useAuth()
  const { refreshSpeakers } = useSpeaker()

  const userState = useAdminUsers()
  const settings = useAdminSettings()

  // Ref avoids circular dependency: onSpeakersChanged needs fetchSpeakers,
  // but fetchSpeakers comes from useAdminSpeakers which takes onSpeakersChanged.
  const speakerFetchRef = useRef<(() => Promise<void>) | null>(null)

  const onSpeakersChanged = useCallback(async () => {
    await speakerFetchRef.current?.()
    await refreshSpeakers()
  }, [refreshSpeakers])

  const speakerState = useAdminSpeakers({
    globalVolumeSaved: settings.globalVolumeSaved,
    onSpeakersChanged,
  })
  speakerFetchRef.current = speakerState.fetchSpeakers

  const bluetooth = useAdminBluetooth({ onSpeakersChanged })

  useEffect(() => {
    if (authLoading) return
    if (!currentUser || currentUser.role !== 'admin') {
      router.push('/')
      return
    }
    userState.fetchUsers()
    speakerState.fetchSpeakers()
    settings.fetchSettings()
    bluetooth.fetchBluetoothStatus()
    bluetooth.fetchBluetoothDevices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser, router])

  if (authLoading || userState.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Administration</h1>
        </div>

        <SettingsSection settings={settings} btAvailable={bluetooth.btAvailable} />
        <UsersSection userState={userState} currentUserId={currentUser!.id} />
        <SpeakersSection speakerState={speakerState} />
        <BluetoothSection bluetooth={bluetooth} />
      </main>
    </div>
  )
}
