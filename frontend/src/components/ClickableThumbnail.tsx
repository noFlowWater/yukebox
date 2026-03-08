import { cn } from '@/lib/utils'

interface ClickableThumbnailProps {
  onClick: () => void
  ariaLabel: string
  className?: string
  children: React.ReactNode
}

export function ClickableThumbnail({ onClick, ariaLabel, className, children }: ClickableThumbnailProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'shrink-0 self-center cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )
}
