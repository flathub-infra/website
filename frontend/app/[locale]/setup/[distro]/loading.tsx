import { Skeleton } from "@/components/ui/skeleton"

export default function DistroSetupLoading() {
  return (
    <div className="max-w-11/12 mx-auto w-11/12 space-y-10 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
      {/* Breadcrumbs Skeleton */}
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-20" />
          <span className="text-flathub-spanish-gray">/</span>
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="prose mx-auto dark:prose-invert">
        <div className="space-y-8">
          {/* Distro Header Section */}
          <div className="flex flex-col items-center space-y-4">
            {/* Distro Logo */}
            <Skeleton className="h-32 w-32 rounded-xl" />

            {/* Distro Name */}
            <Skeleton className="h-10 w-48" />
          </div>

          {/* Setup Instructions */}
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" /> {/* Step number/title */}
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-16 w-full rounded-xl bg-slate-100 dark:bg-slate-800" />{" "}
              {/* Code block */}
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-20 w-full rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-4/5" />
            </div>

            {/* Additional instructions */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
