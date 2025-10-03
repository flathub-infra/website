import { Skeleton } from "@/components/ui/skeleton"
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"

export default function SetupLoading() {
  return (
    <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      {/* Search Input Skeleton */}
      <div className="relative">
        <div className="absolute inset-y-0 start-0 flex items-center ps-2">
          <button
            className="rounded-full p-1 opacity-50"
            aria-hidden="true"
            tabIndex={-1}
          >
            <MagnifyingGlassIcon className="size-5 text-flathub-spanish-gray" />
          </button>
        </div>
        <div className="block w-full rounded-lg bg-flathub-gainsborow/50 py-4 ps-10 pe-2 text-sm dark:bg-flathub-granite-gray/70 h-12">
          <div className="h-4 w-24 bg-flathub-dark-gunmetal/30 dark:bg-flathub-sonic-silver/50 rounded animate-pulse" />
        </div>
      </div>

      {/* Distribution Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 21 }).map((_, index) => (
          <div
            key={index}
            className="flex min-w-0 items-center gap-4 rounded-xl bg-flathub-white px-8 py-6 shadow-md dark:bg-flathub-arsenic/70"
          >
            {/* Distro Logo Skeleton */}
            <Skeleton className="size-24 rounded-lg flex-shrink-0" />

            {/* Distro Name Skeleton */}
            <div className="flex-1 min-w-0">
              <Skeleton className="h-6 w-full max-w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
