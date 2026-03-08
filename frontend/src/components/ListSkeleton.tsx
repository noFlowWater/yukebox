import { Skeleton } from '@/components/ui/skeleton'

interface ListSkeletonProps {
  count?: number
}

export function ListSkeleton({ count = 3 }: ListSkeletonProps) {
  return (
    <div className="flex flex-col gap-3 py-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-14 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
