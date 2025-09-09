"use client"

import { Suspense } from "react"
import SearchBar from "./SearchBar"

const SearchBarSkeleton = () => (
  <div className="relative">
    <div className="absolute inset-y-0 start-0 flex items-center ps-2">
      <div className="rounded-full p-1 opacity-50">
        <div className="size-5 bg-gray-300 rounded animate-pulse" />
      </div>
    </div>
    <div className="block w-full rounded-full bg-flathub-gainsborow/50 py-2 ps-10 pe-2 h-10 animate-pulse" />
  </div>
)

const SearchBarWithSuspense = ({ className }: { className?: string }) => (
  <Suspense fallback={<SearchBarSkeleton />}>
    <SearchBar className={className} />
  </Suspense>
)

export default SearchBarWithSuspense
