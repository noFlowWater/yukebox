interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-fade-in">
      <div className="opacity-40 mb-1">{icon}</div>
      <p className="text-sm font-display font-medium">{title}</p>
      {subtitle && <p className="text-xs mt-1 opacity-70">{subtitle}</p>}
    </div>
  )
}
