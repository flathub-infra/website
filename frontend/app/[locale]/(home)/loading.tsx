import Spinner from "../../../src/components/Spinner"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="space-y-4">
        {/* Hero Banner Skeleton */}
        <Skeleton className="h-64 w-full rounded-xl" />

        {/* App of the Day and Info Section Skeleton */}
        <div className="flex flex-col lg:flex-row gap-4">
          <Skeleton className="h-48 lg:w-1/2 rounded-xl" />
          <Skeleton className="h-48 lg:w-1/2 rounded-xl" />
        </div>
      </div>

      {/* Top Section Skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Category Sections Skeleton */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      ))}

      {/* Fallback spinner in center */}
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner size="m" />
      </div>
    </div>
  )
}
