"use client"

import { BuildDashboard } from "../../../@/components/build/build-dashboard"
import { PipelineRepoWithAll } from "../../../@/components/build/build-repo-filter"
import { useMemo, useState, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Spinner from "src/components/Spinner"
import { Input } from "../../../@/components/ui/input"
import { Button } from "../../../@/components/ui/button"
import { Search, X, Activity } from "lucide-react"
import { Card } from "../../../@/components/ui/card"

function BuildsContent() {
  const [repoFilter, setRepoFilter] = useState<PipelineRepoWithAll>("all")
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const appIdFromUrl = useMemo(
    () => searchParams.get("appId") || undefined,
    [searchParams],
  )

  const [searchInput, setSearchInput] = useState(appIdFromUrl || "")

  const handleSearch = () => {
    if (searchInput.trim()) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("appId", searchInput.trim())
      router.push(`${pathname}?${params.toString()}`)
    } else {
      handleClearSearch()
    }
  }

  const handleClearSearch = () => {
    setSearchInput("")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("appId")
    router.push(
      params.toString() ? `${pathname}?${params.toString()}` : pathname,
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      {/* Hero Header */}
      <div className="space-y-6 pt-8">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl">
            <Activity className="h-12 w-12 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {!appIdFromUrl ? "Build Dashboard" : appIdFromUrl}
            </h1>
            <p className="text-lg text-muted-foreground mt-3">
              Monitor build pipelines and deployment processes across all
              repositories
            </p>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <Card className="p-6 bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Search Builds</h2>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by app ID (e.g., org.gnome.Calculator)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-12 pr-12 h-12 text-base border-2 focus:border-primary transition-all"
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-destructive/10"
                  onClick={() => setSearchInput("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch} size="lg" className="px-8 h-12">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            {appIdFromUrl && (
              <Button
                variant="outline"
                onClick={handleClearSearch}
                size="lg"
                className="h-12"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filter
              </Button>
            )}
          </div>
        </div>
      </Card>

      <BuildDashboard
        appId={appIdFromUrl}
        repoFilter={repoFilter}
        setRepoFilter={setRepoFilter}
      />
    </div>
  )
}

export default function BuildsClient() {
  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <BuildsContent />
    </Suspense>
  )
}
