import { Skeleton } from "@/components/ui/skeleton"
import { ApplicationCardSkeleton } from "src/components/application/ApplicationCard"

export default function AppDetailLoading() {
  return (
    <div className="grid grid-cols-details 2xl:grid-cols-details2xl">
      {/* AppHeader */}
      <header className="col-start-2 flex w-full flex-col gap-7 py-8 pb-6 sm:flex-row">
        <Skeleton className="h-[128px] w-[128px] shrink-0 self-center rounded-[28px]" />
        <div className="my-auto flex flex-1 flex-col gap-1.5">
          <Skeleton className="mx-auto h-9 w-64 sm:mx-0" />
          <Skeleton className="mx-auto h-4 w-40 sm:mx-0" />
          <Skeleton className="mx-auto h-4 w-28 sm:mx-0" />
        </div>
        <div className="flex items-center justify-center gap-4 sm:ms-auto">
          <Skeleton className="h-12 w-40 rounded-xl" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
      </header>

      {/* SubHeader */}
      <div className="col-start-2 flex flex-wrap items-stretch justify-between pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-1 basis-[calc(33%-0.5rem)] flex-col items-center justify-center gap-1 px-3 py-2 sm:basis-0"
          >
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* CarouselStrip */}
      <div className="col-start-1 col-end-4 bg-flathub-gainsborow dark:bg-flathub-arsenic">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center py-6">
          <Skeleton className="h-[288px] w-[512px] shrink-0 rounded-xl" />
        </div>
      </div>

      {/* Content area */}
      <div className="col-start-2 flex flex-col gap-8 pt-2">
        {/* Description */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Releases */}
        <div className="rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic dark:shadow-none">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>

        {/* Links */}
        <div>
          <Skeleton className="mb-3 h-5 w-16" />
          <div className="divide-y divide-flathub-gainsborow rounded-xl bg-flathub-white shadow-md dark:divide-flathub-granite-gray dark:bg-flathub-arsenic dark:shadow-none">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-5 w-5 shrink-0 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </div>

        {/* Developer apps */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-56" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ApplicationCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Tags & Architectures footer */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pt-6">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-36" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
