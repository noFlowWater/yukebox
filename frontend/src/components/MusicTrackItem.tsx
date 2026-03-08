import Image from 'next/image'
import { Play, ListPlus, Heart, CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/utils'
import type { VideoMusicTrack } from '@/types'

export function MusicTrackItem({
  track,
  selecting,
  selected,
  onToggleSelect,
  onPlay,
  onAddToQueue,
  onFavoriteToggle,
  onOpenDetail,
  favoriteId,
}: {
  track: VideoMusicTrack
  selecting: boolean
  selected: boolean
  onToggleSelect: () => void
  onPlay: () => void
  onAddToQueue: () => void
  onFavoriteToggle: () => void
  onOpenDetail: () => void
  favoriteId: number | null
}) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
      {selecting && (
        <button
          className="self-center shrink-0"
          onClick={onToggleSelect}
          aria-label={selected ? 'Deselect' : 'Select'}
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}
      <div
        className="relative shrink-0 self-center w-14 h-10 bg-muted rounded overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="button"
        tabIndex={0}
        onClick={onOpenDetail}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail() } }}
        aria-label={`View details: ${track.title}`}
      >
        <Image
          src={track.thumbnail}
          alt={track.title}
          fill
          className="object-cover"
          sizes="56px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          role="button"
          tabIndex={0}
          className="text-sm font-medium line-clamp-2 cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          onClick={onOpenDetail}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail() } }}
        >
          {track.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {track.duration > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatDuration(track.duration)}
            </p>
          )}
          <div className="flex-1" />
          {!selecting && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:text-primary-foreground hover:bg-primary"
                onClick={onPlay}
                aria-label="Play"
                title="Play"
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onAddToQueue}
                aria-label="Add to Up Next"
                title="Add to Up Next"
              >
                <ListPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${
                  favoriteId !== null
                    ? 'text-red-500 hover:text-red-600'
                    : 'text-muted-foreground hover:text-red-500'
                }`}
                onClick={onFavoriteToggle}
                aria-label={favoriteId !== null ? 'Remove from favorites' : 'Add to favorites'}
                title={favoriteId !== null ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`h-4 w-4 ${favoriteId !== null ? 'fill-current' : ''}`} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
