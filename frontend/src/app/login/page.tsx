'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LogIn, Loader2, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useSpeaker } from '@/contexts/SpeakerContext'
import * as api from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuth()
  const { refreshSpeakers } = useSpeaker()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await api.login(username, password)
      setUser(user)
      refreshSpeakers()
      router.push('/')
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-primary/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-20 -right-20 w-72 h-72 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-xs flex flex-col items-center relative z-10 animate-fade-in">
        <Image src="/icon.svg" alt="YukeBox" width={48} height={48} className="mb-3" />
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">
          YukeBox
        </h1>
        <p className="text-sm text-muted-foreground font-light mb-8">
          Sign in to continue
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            className="h-12 rounded-xl bg-card border-border/50 px-4 text-sm"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-12 rounded-xl bg-card border-border/50 px-4 text-sm"
          />

          {error && <p className="text-sm text-destructive px-1">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !username || !password}
            className="h-12 rounded-xl font-medium mt-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/register" className="text-primary hover:underline">Register</Link>
        </p>

        <a
          href="https://github.com/noFlowWater/yukebox"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <Github className="h-3.5 w-3.5" />
          noFlowWater/yukebox
        </a>
      </div>
    </div>
  )
}
