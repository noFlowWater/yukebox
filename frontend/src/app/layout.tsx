import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/AuthProvider'
import { SpeakerProvider } from '@/contexts/SpeakerContext'
import { StatusProvider } from '@/contexts/StatusContext'
import { AccessibilityProvider } from '@/contexts/AccessibilityContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'YukeBox',
  description: 'Self-hosted YouTube music player for Bluetooth speakers',
  icons: [
    { rel: 'icon', url: '/web-app-manifest-192x192.png', sizes: '192x192' },
    { rel: 'apple-touch-icon', url: '/web-app-manifest-192x192.png', sizes: '192x192' },
  ],
  manifest: '/manifest.json',
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
            <StatusProvider>
              <SpeakerProvider>
                {children}
              </SpeakerProvider>
            </StatusProvider>
          </AuthProvider>
        </AccessibilityProvider>
        <Toaster />
      </body>
    </html>
  )
}
