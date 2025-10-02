import { Skeleton } from "@/components/ui/skeleton"
import { ApplicationCardSkeleton } from "src/components/application/ApplicationCard"
import { FunnelIcon } from "@heroicons/react/24/outline"

export default function SearchLoading() {
  return (
    <div className="max-w-11/12 mx-auto my-0 mt-6 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-3 md:flex-row">
        {/* Desktop filters sidebar */}
        <div className="hidden flex-col gap-3 md:flex">
          <div className="flex min-w-[300px] flex-col gap-4">
            {/* Categories filter */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-20" />
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-top gap-x-2 pt-1.5">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>

            {/* License filter */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-16" />
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-top gap-x-2 pt-1.5">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>

            {/* Verification filter */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-20" />
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-top gap-x-2 pt-1.5">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>

            {/* Types filter */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-20" />
              <div className="flex items-top gap-x-2 pt-1.5">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>

            {/* Architecture filter */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-16" />
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-top gap-x-2 pt-1.5">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex w-full flex-col gap-3">
          {/* Header with title and results count */}
          <span className="flex flex-col">
            <Skeleton className="h-8 w-80 mb-2" />
            <Skeleton className="h-4 w-40" />
          </span>

          {/* Mobile filters button */}
          <div className="md:hidden">
            <div className="w-full h-12 bg-secondary border border-input rounded-md flex items-center justify-center gap-3">
              <FunnelIcon className="size-6" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>

          {/* Search results grid */}
          <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <ApplicationCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
