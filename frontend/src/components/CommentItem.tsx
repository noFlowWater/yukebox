import { ChevronDown, ChevronUp, Pin, ThumbsUp, MessageSquare } from 'lucide-react'
import type { VideoComment } from '@/types'

export function CommentItem({
  comment,
  pinned = false,
  expanded = false,
  overflows = false,
  textRef,
  onToggle,
}: {
  comment: VideoComment
  pinned?: boolean
  expanded?: boolean
  overflows?: boolean
  textRef?: React.RefObject<HTMLParagraphElement | null>
  onToggle?: () => void
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        {pinned ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Pin className="h-3 w-3" />
            Pinned
          </span>
        ) : (
          <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-semibold truncate">{comment.author}</span>
        {comment.like_count > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
            <ThumbsUp className="h-3 w-3" />
            {comment.like_count.toLocaleString()}
          </span>
        )}
      </div>
      <p
        ref={textRef}
        className={`text-sm text-muted-foreground whitespace-pre-line break-words ${
          pinned && !expanded ? 'line-clamp-4' : pinned ? '' : 'line-clamp-3'
        }`}
      >
        {comment.text}
      </p>
      {pinned && overflows && onToggle && (
        <button
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
          onClick={onToggle}
        >
          {expanded ? (
            <>Show less <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Show more <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  )
}
