import { cn } from '@/lib/utils'

const VARIANT_CLASSES = {
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  primary: 'bg-primary/20 text-primary',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/20 text-destructive',
} as const

interface StatusPillProps {
  variant: keyof typeof VARIANT_CLASSES
  className?: string
  children: React.ReactNode
}

export function StatusPill({ variant, className, children }: StatusPillProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
      VARIANT_CLASSES[variant],
      className,
    )}>
      {children}
    </span>
  )
}
