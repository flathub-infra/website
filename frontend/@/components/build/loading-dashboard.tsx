import { Skeleton } from "@/components/ui/skeleton"

export function LoadingDashboard() {
  return (
    <div className="space-y-6">
      {/* Repo Filter Skeleton */}
      <div className="p-5 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg">
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Section Skeletons */}
      {Array.from({ length: 3 }).map((_, sectionIdx) => (
        <div key={sectionIdx} className="space-y-3">
          {/* Section Header */}
          <div className="p-4 bg-card border rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-5" />
          </div>

          {/* Table Skeleton */}
          <div className="border rounded-lg overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <div className="bg-gradient-to-r from-muted to-muted/60 border-b-2 grid grid-cols-7 gap-4 p-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-7 gap-4 p-4 border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <Skeleton key={j} className="h-5 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
