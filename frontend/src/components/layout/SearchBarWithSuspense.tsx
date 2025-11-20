import { Suspense } from "react"
import SearchBar from "./SearchBar"
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"

const SearchBarSkeleton = () => (
  <div className="relative">
    <div className="absolute inset-y-0 start-0 flex items-center ps-2">
      <div className="rounded-full p-1 opacity-50">
        <MagnifyingGlassIcon className="size-5 text-flathub-spanish-gray" />
      </div>
    </div>
    <div className="block w-full rounded-full bg-flathub-gainsborow/50 py-2 ps-10 pe-2 h-9 animate-pulse" />
    <div className="pointer-events-none absolute inset-y-0 end-0 hidden items-center pe-5 peer-focus:hidden md:flex">
      <kbd
        className="flex size-5 items-center justify-center rounded border-2 border-flathub-gray-x11/60 font-sans text-xs text-flathub-arsenic dark:border-flathub-sonic-silver dark:text-flathub-gainsborow"
        aria-hidden="true"
      >
        /
      </kbd>
    </div>
  </div>
)

const SearchBarWithSuspense = ({ className }: { className?: string }) => (
  <Suspense fallback={<SearchBarSkeleton />}>
    <SearchBar className={className} />
  </Suspense>
)

export default SearchBarWithSuspense
