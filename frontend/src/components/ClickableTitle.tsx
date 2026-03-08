import { cn } from '@/lib/utils'

interface ClickableTitleProps {
  onClick: () => void
  className?: string
  children: React.ReactNode
}

export function ClickableTitle({ onClick, className, children }: ClickableTitleProps) {
  return (
    <p
      role="button"
      tabIndex={0}
      className={cn(
        'text-sm font-medium line-clamp-2 cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
        className,
      )}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {children}
    </p>
  )
}
