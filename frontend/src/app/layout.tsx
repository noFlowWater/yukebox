import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/AuthProvider'
import { SpeakerProvider } from '@/contexts/SpeakerContext'
import { AccessibilityProvider } from '@/contexts/AccessibilityContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'YukeBox',
  description: 'Self-hosted YouTube music player for Bluetooth speakers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <AccessibilityProvider>
          <AuthProvider>
            <SpeakerProvider>
              {children}
            </SpeakerProvider>
          </AuthProvider>
        </AccessibilityProvider>
        <Toaster />
      </body>
    </html>
  )
}
