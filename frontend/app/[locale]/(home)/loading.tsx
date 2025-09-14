import Spinner from "../../../src/components/Spinner"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="space-y-4">
        {/* Hero Banner Skeleton */}
        <div className="overflow-hidden shadow-md rounded-xl">
          <div className="h-[288px] xl:h-[352px] bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
            <div className="flex justify-center flex-row w-full h-full gap-6 px-16">
              <div className="flex flex-col justify-center items-center lg:w-1/3 h-auto w-full">
                {/* App Icon */}
                <div className="relative flex shrink-0 flex-wrap items-center justify-center drop-shadow-md lg:h-[128px] lg:w-[128px]">
                  <Skeleton className="h-24 w-24 lg:h-32 lg:w-32 rounded-2xl" />
                </div>
                {/* App Name */}
                <div className="flex pt-3">
                  <Skeleton className="h-8 w-32 mb-2" />
                </div>
                {/* App Summary */}
                <div className="text-center w-full">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              </div>
              {/* Screenshot Area */}
              <div className="hidden w-2/3 xl:flex justify-center items-center overflow-hidden relative h-auto">
                <Skeleton className="h-48 w-80 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* App of the Day and Info Section Skeleton */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* App of the Day Skeleton */}
          <div className="lg:w-1/2 rounded-xl bg-gradient-to-r bg-bottom bg-repeat p-6 shadow-md bg-slate-100/90 dark:bg-slate-800/90">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-4" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>

          {/* Flathub Info Section Skeleton */}
          <div className="lg:w-1/2 rounded-xl bg-repeat bg-[length:420px_420px] bg-bottom shadow-md overflow-hidden">
            <div className="p-8 w-full h-full bg-slate-100/90 dark:bg-slate-800/90">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-6" />
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-12 w-32 rounded-lg" />
                <Skeleton className="h-12 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Section Skeleton */}
      <div className="space-y-4">
        {/* Multi Toggle Buttons */}
        <div className="flex gap-2 overflow-x-auto">
          <Skeleton className="h-12 w-24 rounded-lg flex-shrink-0" />
          <Skeleton className="h-12 w-20 rounded-lg flex-shrink-0" />
          <Skeleton className="h-12 w-16 rounded-lg flex-shrink-0" />
          <Skeleton className="h-12 w-24 rounded-lg flex-shrink-0" />
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
    </div>
  )
}
