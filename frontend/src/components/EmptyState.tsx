interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      {icon}
      <p className="text-sm">{title}</p>
      {subtitle && <p className="text-xs mt-1">{subtitle}</p>}
    </div>
  )
}
