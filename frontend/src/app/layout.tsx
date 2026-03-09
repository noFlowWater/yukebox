import type { Metadata, Viewport } from 'next'
import { Syne, Lexend } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/AuthProvider'
import { SpeakerProvider } from '@/contexts/SpeakerContext'
import { StatusProvider } from '@/contexts/StatusContext'
import { AccessibilityProvider } from '@/contexts/AccessibilityContext'
import './globals.css'

const displayFont = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const bodyFont = Lexend({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'YukeBox',
  description: 'Self-hosted YouTube music player for Bluetooth speakers',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${displayFont.variable} ${bodyFont.variable}`}>
      <body className="font-sans">
        <AccessibilityProvider>
          <AuthProvider>
            <SpeakerProvider>
              <StatusProvider>
                {children}
              </StatusProvider>
            </SpeakerProvider>
          </AuthProvider>
        </AccessibilityProvider>
        <Toaster />
      </body>
    </html>
  )
}
