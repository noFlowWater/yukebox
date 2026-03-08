import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('getVideoMusic', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeNextResponse(cards: Array<{
    title: string
    artist: string
    album?: string
    videoId?: string
    albumThumb?: string
  }>) {
    const cardList = cards.map((c) => ({
      videoAttributeViewModel: {
        title: c.title,
        subtitle: c.artist,
        secondarySubtitle: c.album ? { content: c.album } : undefined,
        image: c.albumThumb ? { sources: [{ url: c.albumThumb }] } : undefined,
        onTap: c.videoId
          ? { innertubeCommand: { watchEndpoint: { videoId: c.videoId } } }
          : {},
      },
    }))

    return {
      engagementPanels: [
        {
          engagementPanelSectionListRenderer: {
            content: {
              structuredDescriptionContentRenderer: {
                items: [
                  {
                    horizontalCardListRenderer: {
                      header: {
                        richListHeaderRenderer: {
                          title: { simpleText: 'Music' },
                        },
                      },
                      cards: cardList,
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    }
  }

  function makePlayerResponse(lengthSeconds: string) {
    return { videoDetails: { lengthSeconds } }
  }

  it('should discover tracks and resolve durations', async () => {
    const nextResponse = makeNextResponse([
      { title: 'Awake', artist: 'Tycho', album: 'Awake', videoId: 'abc123track1' },
      { title: 'Montana', artist: 'Tycho', album: 'Dive', videoId: 'def456track2' },
    ])

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(nextResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makePlayerResponse('228')),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makePlayerResponse('253')),
      })

    const { getVideoMusic } = await import('../../services/youtube-music.service.js')
    const result = await getVideoMusic('https://www.youtube.com/watch?v=testVideo001')

    expect(result.count).toBe(2)
    expect(result.tracks).toHaveLength(2)
    expect(result.tracks[0]).toEqual({
      url: 'https://www.youtube.com/watch?v=abc123track1',
      title: 'Awake - Tycho',
      thumbnail: 'https://i.ytimg.com/vi/abc123track1/hqdefault.jpg',
      duration: 228,
      artist: 'Tycho',
      album: 'Awake',
      albumThumbnail: '',
    })
    expect(result.tracks[1].duration).toBe(253)
  })

  it('should skip cards without videoId', async () => {
    const nextResponse = makeNextResponse([
      { title: 'Despacito', artist: 'Luis Fonsi' },
      { title: 'Awake', artist: 'Tycho', videoId: 'abc123track1' },
    ])

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(nextResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makePlayerResponse('228')),
      })

    const { getVideoMusic } = await import('../../services/youtube-music.service.js')
    const result = await getVideoMusic('https://www.youtube.com/watch?v=testVideo002')

    expect(result.count).toBe(1)
    expect(result.tracks[0].title).toBe('Awake - Tycho')
  })

  it('should return empty when no music section exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ engagementPanels: [] }),
    })

    const { getVideoMusic } = await import('../../services/youtube-music.service.js')
    const result = await getVideoMusic('https://www.youtube.com/watch?v=testVideo003')

    expect(result.count).toBe(0)
    expect(result.tracks).toHaveLength(0)
  })

  it('should return empty on /next API failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { getVideoMusic } = await import('../../services/youtube-music.service.js')
    const result = await getVideoMusic('https://www.youtube.com/watch?v=testVideo004')

    expect(result.count).toBe(0)
    expect(result.tracks).toHaveLength(0)
  })

  it('should fallback duration to 0 when /player fails', async () => {
    const nextResponse = makeNextResponse([
      { title: 'Awake', artist: 'Tycho', videoId: 'abc123track1' },
    ])

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(nextResponse),
      })
      .mockResolvedValueOnce({ ok: false })

    const { getVideoMusic } = await import('../../services/youtube-music.service.js')
    const result = await getVideoMusic('https://www.youtube.com/watch?v=testVideo005')

    expect(result.count).toBe(1)
    expect(result.tracks[0].duration).toBe(0)
  })

  it('should return empty for invalid URL without video ID', async () => {
    const { getVideoMusic } = await import('../../services/youtube-music.service.js')
    const result = await getVideoMusic('https://example.com/not-youtube')

    expect(result.count).toBe(0)
    expect(result.tracks).toHaveLength(0)
  })

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { getVideoMusic } = await import('../../services/youtube-music.service.js')
    const result = await getVideoMusic('https://www.youtube.com/watch?v=testVideo006')

    expect(result.count).toBe(0)
    expect(result.tracks).toHaveLength(0)
  })
})
