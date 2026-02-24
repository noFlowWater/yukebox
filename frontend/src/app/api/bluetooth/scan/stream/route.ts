import { NextRequest } from 'next/server'

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:4000'

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('cookie') || ''
  const duration = request.nextUrl.searchParams.get('duration')
  const params = duration ? `?duration=${duration}` : ''

  const upstream = await fetch(`${INTERNAL_API_URL}/api/bluetooth/scan/stream${params}`, {
    headers: { cookie },
    signal: request.signal,
  })

  if (!upstream.ok || !upstream.body) {
    return new Response('SSE upstream failed', { status: upstream.status })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export const dynamic = 'force-dynamic'
