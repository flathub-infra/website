"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Search, X, Activity } from "lucide-react"
import { BuildDashboard } from "../../../@/components/build/build-dashboard"
import {
  BuildRepoFilter,
  PipelineRepoWithAll,
} from "../../../@/components/build/build-repo-filter"
import {
  BuildStatusFilter,
  PipelineStatusWithAll,
  isPipelineStatusWithAll,
} from "../../../@/components/build/build-status-filter"
import { BuildStatusBanner } from "../../../@/components/build/build-status-banner"
import { Input } from "../../../@/components/ui/input"
import { Button } from "../../../@/components/ui/button"
import { Card } from "../../../@/components/ui/card"
import { Link } from "src/i18n/navigation"
import Spinner from "src/components/Spinner"

const repos: Record<PipelineRepoWithAll, true> = {
  all: true,
  stable: true,
  beta: true,
  test: true,
}

function utcDate(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function BuildsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const appId = searchParams.get("appId") || ""
  const repoValue = searchParams.get("repo") || "all"
  const statusValue = searchParams.get("status") || "all"
  const repo = (
    Object.hasOwn(repos, repoValue) ? repoValue : "all"
  ) as PipelineRepoWithAll
  const status = isPipelineStatusWithAll(statusValue) ? statusValue : "all"
  const dateFrom = searchParams.get("dateFrom") || ""
  const dateTo = searchParams.get("dateTo") || ""
  const [searchInput, setSearchInput] = useState(appId)
  const [fromInput, setFromInput] = useState(dateFrom)
  const [toInput, setToInput] = useState(dateTo)
  useEffect(() => setSearchInput(appId), [appId])
  useEffect(() => setFromInput(dateFrom), [dateFrom])
  useEffect(() => setToInput(dateTo), [dateTo])

  const update = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") params.set(key, value)
      else params.delete(key)
    }
    router.push(params.size ? `${pathname}?${params}` : pathname)
  }
  const from = utcDate(fromInput)
  const to = utcDate(toInput)
  const invalidDate = Boolean(
    (fromInput && !from) || (toInput && !to) || (from && to && from > to),
  )
  const invalidUrlDate = Boolean(
    (dateFrom && !utcDate(dateFrom)) ||
    (dateTo && !utcDate(dateTo)) ||
    (dateFrom && dateTo && utcDate(dateFrom)! > utcDate(dateTo)!),
  )

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="space-y-6 pt-8">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl">
            <Activity className="h-12 w-12 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="min-w-0 break-all text-3xl sm:text-5xl font-extrabold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Builds
            </h1>
            <p className="text-lg text-muted-foreground mt-3">
              Monitor build pipelines and deployment processes across all
              repositories
            </p>
          </div>
        </div>
      </div>
      <BuildStatusBanner />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="sr-only">Search and filter builds</h2>
          <Input
            aria-label="Search by app ID"
            placeholder="Search by app ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ appId: searchInput.trim() })
            }}
            className="h-9 flex-1 min-w-48"
          />
          <Button onClick={() => update({ appId: searchInput.trim() })}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSearchInput("")
              setFromInput("")
              setToInput("")
              update({
                appId: "",
                repo: "",
                status: "",
                dateFrom: "",
                dateTo: "",
              })
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BuildRepoFilter
            selectedRepoStatus={repo}
            className="h-9"
            setSelectedRepoStatus={(value) => update({ repo: value })}
          />
          <BuildStatusFilter
            selectedStatus={status}
            className="h-9"
            setSelectedStatus={(value) => update({ status: value })}
          />
          <label htmlFor="builds-date-from" className="sr-only">
            From (UTC)
          </label>
          <Input
            id="builds-date-from"
            type="datetime-local"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="h-9 w-52"
          />
          <label htmlFor="builds-date-to" className="sr-only">
            To (UTC)
          </label>
          <Input
            id="builds-date-to"
            type="datetime-local"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="h-9 w-52"
          />
          <Button
            variant="outline"
            disabled={invalidDate}
            onClick={() => update({ dateFrom: fromInput, dateTo: toInput })}
          >
            Apply dates
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/builds/reproducible">Fleet reproducibility</Link>
          </Button>
        </div>
        {invalidDate && (
          <p role="alert" className="text-destructive text-sm">
            Enter valid UTC dates with From no later than To.
          </p>
        )}
      </Card>
      {invalidUrlDate ? (
        <p role="alert" className="text-destructive">
          Invalid date filter. Clear filters to load builds.
        </p>
      ) : (
        <BuildDashboard
          appId={appId || undefined}
          repoFilter={repo}
          statusFilter={status}
          dateFrom={dateFrom ? utcDate(dateFrom) : undefined}
          dateTo={dateTo ? utcDate(dateTo) : undefined}
        />
      )}
    </div>
  )
}

export default function BuildsClient() {
  return (
    <Suspense fallback={<Spinner size="m" />}>
      <BuildsContent />
    </Suspense>
  )
}
