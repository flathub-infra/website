"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Search, X, CalendarDays, ChevronDown, Repeat2 } from "lucide-react"
import { Link } from "src/i18n/navigation"
import {
  BuildNavigation,
  BuildPageHeader,
} from "@/components/build/build-page-header"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
  const [datesExpanded, setDatesExpanded] = useState(
    Boolean(dateFrom || dateTo),
  )
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
  const hasFilters = Boolean(
    appId ||
    searchInput ||
    repo !== "all" ||
    status !== "all" ||
    dateFrom ||
    dateTo ||
    fromInput ||
    toInput,
  )

  return (
    <div className="build-page">
      <BuildNavigation />
      <BuildPageHeader
        title="Build activity"
        description="Follow builds, inspect results, and track what’s shipping across every repository."
        actions={
          <Button variant="outline" asChild>
            <Link href="/builds/reproducible">
              <Repeat2 data-icon="inline-start" />
              Reproducibility
            </Link>
          </Button>
        }
      />
      <BuildStatusBanner />
      <section
        className="build-filter-panel"
        aria-label="Search and filter builds"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="sr-only">Search and filter builds</h2>
          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor="builds-search" className="sr-only">
              Search by app ID
            </FieldLabel>
            <Input
              id="builds-search"
              aria-label="Search by app ID"
              placeholder="Search by app ID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") update({ appId: searchInput.trim() })
              }}
              className="h-9 flex-1 min-w-48"
            />
          </Field>
          <Button onClick={() => update({ appId: searchInput.trim() })}>
            <Search data-icon="inline-start" />
            Search
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
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
              <X data-icon="inline-start" />
              Reset
            </Button>
          )}
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
          <Button
            variant="ghost"
            aria-expanded={datesExpanded}
            aria-controls="builds-date-range"
            onClick={() => setDatesExpanded((expanded) => !expanded)}
          >
            <CalendarDays aria-hidden="true" data-icon="inline-start" />
            Date range (UTC)
            {(dateFrom || dateTo) && (
              <>
                <span className="size-1.5 rounded-full bg-primary" />
                <span className="sr-only">Filter active</span>
              </>
            )}
            <ChevronDown
              aria-hidden="true"
              data-icon="inline-end"
              className={datesExpanded ? "rotate-180" : undefined}
            />
          </Button>
        </div>
        <div id="builds-date-range" hidden={!datesExpanded}>
          <FieldGroup className="flex-wrap gap-3 sm:flex-row sm:items-end">
            <Field className="sm:w-auto" data-invalid={invalidDate}>
              <FieldLabel htmlFor="builds-date-from">From (UTC)</FieldLabel>
              <Input
                id="builds-date-from"
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                aria-invalid={invalidDate}
                className="h-9 sm:w-56"
              />
            </Field>
            <Field className="sm:w-auto" data-invalid={invalidDate}>
              <FieldLabel htmlFor="builds-date-to">To (UTC)</FieldLabel>
              <Input
                id="builds-date-to"
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                aria-invalid={invalidDate}
                className="h-9 sm:w-56"
              />
            </Field>
            <Button
              variant="outline"
              disabled={
                invalidDate || (fromInput === dateFrom && toInput === dateTo)
              }
              onClick={() => update({ dateFrom: fromInput, dateTo: toInput })}
            >
              Apply dates
            </Button>
          </FieldGroup>
        </div>
        {invalidDate && (
          <p role="alert" className="text-destructive text-sm">
            Enter valid UTC dates with From no later than To.
          </p>
        )}
      </section>
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
