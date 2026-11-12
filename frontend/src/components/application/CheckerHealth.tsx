"use client"

import { useFormatter } from "next-intl"
import { checkerHealthText as t } from "./CheckerHealth.messages"
import CheckerSelection from "./CheckerSelection"
import { useId, useState, type ReactNode } from "react"
import {
  CircleCheck,
  CircleHelp,
  ChevronDown,
  GitBranch,
  RefreshCw,
  CircleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup } from "radix-ui"
import { cn } from "@/lib/utils"
import { useGetCheckerHealthAppsAppIdCheckerHealthGet } from "src/codegen/checker-health/checker-health"
import type {
  CheckerHealth as Health,
  CheckerSourceHealth,
  Checkout,
  Submodule,
} from "src/codegen/model"

const disclosureClass =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
const detailsClass = "[&[open]>summary>svg]:rotate-180"

function useCheckDate() {
  const format = useFormatter()
  return (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    })
}

function DisclosureTitle({ children }: { children: ReactNode }) {
  return (
    <summary className={disclosureClass}>
      <span className="min-w-0">{children}</span>
      <ChevronDown
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </summary>
  )
}

function RunLink({
  url,
  children,
  prominent = false,
}: {
  url: string
  children: ReactNode
  prominent?: boolean
}) {
  if (!prominent) {
    return (
      <a
        className="inline-flex min-h-11 items-center rounded-sm text-foreground underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    )
  }
  return (
    <Button
      asChild
      variant="secondary"
      className="min-h-11 max-w-full whitespace-normal text-start"
    >
      <a href={url} target="_blank" rel="noreferrer">
        {children}
      </a>
    </Button>
  )
}

function sourceKey(item: CheckerSourceHealth, index: number) {
  return JSON.stringify([
    item.branch,
    item.source.manifest,
    item.source.source_pointer,
    item.source.module,
    item.source.type,
    item.source.checker_type,
    ...(item.source.source_pointer === null
      ? [item.run_url, item.observed_at, index]
      : []),
  ])
}

function sourceGroup(item: CheckerSourceHealth) {
  if (item.failures || item.source.status === "failed") {
    return "failures"
  }
  if (["blocked", "update_available"].includes(item.source.status)) {
    return "updates"
  }
  if (item.source.status === "checked" && item.recovered_at) {
    return "recovered"
  }
  return item.source.status
}

function Source({
  observation,
  initiallyExpanded,
  sharedManifest,
  sharedObservedAt,
}: {
  observation: CheckerSourceHealth
  initiallyExpanded: boolean
  sharedManifest?: string
  sharedObservedAt?: string
}) {
  const date = useCheckDate()
  const source = observation.source
  const unresolved = Boolean(observation.failures)
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [rawExpanded, setRawExpanded] = useState(false)
  const rawId = useId()
  const errors = source.errors?.length
    ? source.errors
    : unresolved
      ? observation.failure_errors
      : []
  const status = unresolved
    ? "unresolved"
    : sourceGroup(observation) === "recovered"
      ? "recovered"
      : source.status
  const reasonKey = `reason-${source.reason}`
  const showManifest = source.module && source.manifest !== sharedManifest
  const showObservedAt = observation.observed_at !== sharedObservedAt
  const currentVersion =
    source.current.version ||
    ("tag" in source.current
      ? source.current.tag || source.current.commit?.slice(0, 12)
      : null)

  return (
    <li className="min-w-0 border-t border-border/60 first:border-t-0">
      <details
        className={detailsClass}
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary
          className={cn(
            disclosureClass,
            "gap-3 rounded-none px-3 py-3 hover:bg-muted/60 focus-visible:-outline-offset-2 sm:px-4",
            expanded && "bg-muted/40",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              className="font-medium [overflow-wrap:anywhere]"
              title={showManifest ? source.manifest : undefined}
            >
              {source.module || source.manifest}
            </span>
            {showObservedAt && (
              <span className="text-xs text-muted-foreground">
                {showObservedAt && (
                  <time dateTime={observation.observed_at}>
                    {t("observed-time", {
                      date: date(observation.observed_at),
                    })}
                  </time>
                )}
              </span>
            )}
          </span>
          {currentVersion && (
            <span
              className="hidden max-w-32 truncate text-xs tabular-nums text-muted-foreground sm:block"
              title={currentVersion}
            >
              {currentVersion}
            </span>
          )}
          {unresolved || source.status === "failed" ? (
            <Badge
              variant="destructive"
              className="max-w-[45%] gap-1.5 text-start"
            >
              <CircleAlert className="size-3.5 shrink-0" aria-hidden />
              {t(`status-${status}`)}
            </Badge>
          ) : (
            <span className="flex max-w-[45%] items-center justify-end gap-1.5 text-end text-xs text-muted-foreground">
              {(status === "checked" || status === "recovered") && (
                <CircleCheck className="size-3.5 shrink-0" aria-hidden />
              )}
              {status === "unchecked" && (
                <CircleHelp className="size-3.5 shrink-0" aria-hidden />
              )}
              {t(`status-${status}`)}
            </span>
          )}
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </summary>
        {expanded && (
          <div className="flex min-w-0 flex-col gap-3 px-3 pb-4 pt-1 sm:px-4">
            {unresolved && (
              <div className="flex flex-col gap-1">
                <p className="font-medium">
                  {t("failures", { count: observation.failures ?? 0 })}
                </p>
                {source.status !== "failed" && (
                  <p className="max-w-prose text-muted-foreground">
                    {t("unresolved-note")}
                  </p>
                )}
              </div>
            )}
            {!!errors?.length && (
              <ul className="flex flex-col gap-3">
                {errors.map((error, index) => (
                  <li
                    key={index}
                    className="flex flex-col gap-1 [overflow-wrap:anywhere]"
                  >
                    <span className="text-xs font-semibold">{error.type}</span>
                    <p className="max-w-prose">{error.message}</p>
                  </li>
                ))}
              </ul>
            )}
            {source.status === "blocked" && (
              <p className="max-w-prose">{t("blocked-note")}</p>
            )}
            {source.reason && (
              <p className="max-w-prose text-muted-foreground">
                {t.has(reasonKey) ? t(reasonKey) : source.reason}
              </p>
            )}
            {observation.recovered_at && (
              <p>{t("recovered", { date: date(observation.recovered_at) })}</p>
            )}
            <div className="order-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <RunLink
                prominent={unresolved || source.status === "failed"}
                url={
                  unresolved && observation.last_failure_run_url
                    ? observation.last_failure_run_url
                    : observation.run_url
                }
              >
                {unresolved || source.status === "failed"
                  ? t("failure-logs")
                  : t("run-logs")}
              </RunLink>
              {unresolved && observation.last_failure_at && (
                <span className="text-xs text-muted-foreground sm:ms-auto">
                  {t("last-failure-time", {
                    date: date(observation.last_failure_at),
                  })}
                </span>
              )}
              {unresolved &&
                observation.last_failure_run_url &&
                observation.last_failure_run_url !== observation.run_url && (
                  <a
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                    href={observation.run_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("latest-source-logs")}
                  </a>
                )}
              <Button
                variant="ghost"
                className="min-h-11 gap-2 px-2 sm:ms-auto"
                aria-expanded={rawExpanded}
                aria-controls={rawId}
                onClick={() => setRawExpanded((value) => !value)}
              >
                {t("source-evidence")}
                <ChevronDown
                  data-icon="inline-end"
                  aria-hidden
                  className={cn(rawExpanded && "rotate-180")}
                />
              </Button>
            </div>
            <dl className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-3 pt-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,3fr)]">
              <div>
                <dt className="text-muted-foreground">
                  {t("current-version")}
                </dt>
                <dd className="mt-1 [overflow-wrap:anywhere]">
                  {currentVersion || t("version-unknown")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("checker")}</dt>
                <dd className="mt-1 [overflow-wrap:anywhere]">
                  {source.checker_type || t("no-checker")}
                </dd>
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <dt className="text-muted-foreground">{t("location")}</dt>
                <dd className="mt-1 [overflow-wrap:anywhere]" dir="ltr">
                  {showManifest || !sharedManifest ? (
                    <>
                      {source.manifest}
                      <br />
                    </>
                  ) : null}
                  {source.source_pointer === null
                    ? t("unknown-location")
                    : source.source_pointer || t("document-root")}
                </dd>
              </div>
              {unresolved && (
                <div>
                  <dt className="text-muted-foreground">
                    {t("latest-result")}
                  </dt>
                  <dd className="mt-1">{t(`status-${source.status}`)}</dd>
                </div>
              )}
              {source.selected_version && (
                <div>
                  <dt className="text-muted-foreground">
                    {t("selected-version")}
                  </dt>
                  <dd className="mt-1 [overflow-wrap:anywhere]">
                    {source.selected_version}
                  </dd>
                </div>
              )}
            </dl>
            <div id={rawId} className="order-2" hidden={!rawExpanded}>
              {rawExpanded && (
                <Textarea
                  readOnly
                  rows={12}
                  className="max-h-80"
                  dir="ltr"
                  aria-label={t("source-evidence")}
                  value={JSON.stringify(source, null, 2)}
                />
              )}
            </div>
          </div>
        )}
      </details>
    </li>
  )
}

function SourceSummary({ sources }: { sources: CheckerSourceHealth[] }) {
  const format = useFormatter()
  const groups = ["failures", "updates", "recovered", "checked", "unchecked"]
  const counts = Object.fromEntries(
    groups.map((group) => [
      group,
      sources.filter((item) => sourceGroup(item) === group).length,
    ]),
  )

  return (
    <div className="flex items-start gap-3">
      {counts.failures ? (
        <CircleAlert
          className="mt-0.5 size-5 shrink-0 text-foreground"
          aria-hidden
        />
      ) : (
        <CircleCheck
          className="mt-0.5 size-5 shrink-0 text-primary"
          aria-hidden
        />
      )}
      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-medium">
          {counts.failures
            ? t("summary-failures", { count: counts.failures })
            : t("summary-no-failures")}
        </p>
        <dl
          className={cn(
            "flex flex-wrap gap-x-5 gap-y-2 text-xs",
            sources.length > 10 && "sm:hidden",
          )}
        >
          {groups
            .filter((group) => counts[group] > 0)
            .map((group) => (
              <div key={group} className="flex flex-row-reverse gap-1.5">
                <dt className="text-muted-foreground">
                  {t(`filter-${group}`)}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {format.number(counts[group])}
                </dd>
              </div>
            ))}
        </dl>
        <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
          {t("observation-note")}
        </p>
      </div>
    </div>
  )
}

function SourceList({
  sources,
  reportAt,
}: {
  sources: CheckerSourceHealth[]
  reportAt: string
}) {
  const format = useFormatter()
  const date = useCheckDate()
  const id = useId()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [limit, setLimit] = useState(10)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const groups = ["failures", "updates", "recovered", "checked", "unchecked"]
  const counts = Object.fromEntries(
    groups.map((group) => [
      group,
      sources.filter((item) => sourceGroup(item) === group).length,
    ]),
  )
  const needle = search.trim().toLocaleLowerCase()
  const matches = sources
    .map((item, index) => ({ item, key: sourceKey(item, index) }))
    .filter(
      ({ item }) =>
        (filter === "all" || sourceGroup(item) === filter) &&
        [
          item.source.module,
          item.source.manifest,
          item.source.source_pointer,
          item.branch,
          item.source.checker_type,
        ].some((value) => value?.toLocaleLowerCase().includes(needle)),
    )
    .toSorted(
      (a, b) =>
        groups.indexOf(sourceGroup(a.item)) -
        groups.indexOf(sourceGroup(b.item)),
    )
  const sharedMetadata = new Map<
    string | null,
    { manifest?: string; observedAt?: string }
  >()
  for (const { branch, source, observed_at } of sources) {
    const key = branch ?? null
    const shared = sharedMetadata.get(key)
    if (!shared) {
      sharedMetadata.set(key, {
        manifest: source.manifest,
        observedAt: observed_at,
      })
    } else {
      if (shared.manifest !== source.manifest) {
        shared.manifest = undefined
      }
      if (shared.observedAt !== observed_at) {
        shared.observedAt = undefined
      }
    }
  }
  const branches = new Map<
    string | null,
    {
      items: typeof matches
      sharedManifest?: string
      sharedObservedAt?: string
    }
  >()
  for (const entry of matches.slice(0, limit)) {
    const branch = entry.item.branch ?? null
    let group = branches.get(branch)
    if (!group) {
      group = {
        items: [],
        sharedManifest: sharedMetadata.get(branch)?.manifest,
        sharedObservedAt: sharedMetadata.get(branch)?.observedAt,
      }
      branches.set(branch, group)
    }
    group.items.push(entry)
  }
  const showFilters = sources.length > 10 || filtersExpanded

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h4 className="font-semibold">{t("sources")}</h4>
        <p className="text-xs text-muted-foreground" role="status">
          {!search && filter === "all" && matches.length <= limit
            ? t("source-total", { count: matches.length })
            : t("source-count", {
                shown: Math.min(limit, matches.length),
                total: matches.length,
              })}
        </p>
        {sources.length <= 10 && (
          <Button
            variant="ghost"
            className="min-h-11 px-0 sm:ms-auto"
            aria-expanded={showFilters}
            aria-controls={`${id}-filters`}
            onClick={() => setFiltersExpanded((value) => !value)}
          >
            {t("search-filter")}
            {(search || filter !== "all") && <span>{t("filters-active")}</span>}
            <ChevronDown
              data-icon="inline-end"
              aria-hidden
              className={cn(showFilters && "rotate-180")}
            />
          </Button>
        )}
      </div>
      <div
        id={`${id}-filters`}
        hidden={!showFilters}
        className={cn("flex-wrap items-center gap-3", showFilters && "flex")}
      >
        <div className="flex min-w-0 flex-1 basis-52 flex-col gap-1.5">
          <label htmlFor={`${id}-search`} className="sr-only">
            {t("find-source")}
          </label>
          <Input
            variant="surface"
            id={`${id}-search`}
            type="search"
            value={search}
            placeholder={t("search-placeholder")}
            className="h-11 rounded-lg"
            onChange={(event) => {
              setSearch(event.target.value)
              setLimit(10)
            }}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:hidden">
          <label htmlFor={`${id}-filter`} className="sr-only">
            {t("filter-status")}
          </label>
          <select
            id={`${id}-filter`}
            className="h-11 max-w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setLimit(10)
            }}
          >
            <option value="all">
              {t("filter-all")} ({format.number(sources.length)})
            </option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {t(`filter-${group}`)} ({format.number(counts[group])})
              </option>
            ))}
          </select>
        </div>
        {showFilters && (
          <ToggleGroup.Root
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (value) {
                setFilter(value)
                setLimit(10)
              }
            }}
            aria-label={t("filter-status")}
            className="hidden flex-wrap gap-1 sm:flex"
          >
            {[
              "all",
              ...groups.filter(
                (group) => counts[group] > 0 || filter === group,
              ),
            ].map((group) => (
              <ToggleGroup.Item
                key={group}
                value={group}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:bg-muted data-[state=on]:border-primary data-[state=on]:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {t(`filter-${group}`)}
                <span className="tabular-nums">
                  {format.number(
                    group === "all" ? sources.length : counts[group],
                  )}
                </span>
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        )}
      </div>
      {matches.length ? (
        <div className="flex min-w-0 flex-col gap-6">
          {[...branches].map(([branch, group], index) => (
            <section
              key={JSON.stringify(branch)}
              aria-labelledby={`${id}-branch-${index}`}
              className="min-w-0"
            >
              <div className="mb-2 flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h5
                    id={`${id}-branch-${index}`}
                    className="flex min-w-0 items-center gap-2 text-xs font-medium [overflow-wrap:anywhere]"
                  >
                    <GitBranch
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      {branch ?? t("default-branch")}
                    </span>
                  </h5>
                  {group.sharedObservedAt &&
                    group.sharedObservedAt !== reportAt && (
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={group.sharedObservedAt}
                      >
                        {t("observed-time", {
                          date: date(group.sharedObservedAt),
                        })}
                      </time>
                    )}
                </div>
                {group.sharedManifest && (
                  <p
                    className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]"
                    dir="ltr"
                  >
                    {group.sharedManifest}
                  </p>
                )}
              </div>
              <ul className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
                {group.items.map(({ item, key }) => (
                  <Source
                    key={key}
                    observation={item}
                    sharedManifest={group.sharedManifest}
                    sharedObservedAt={group.sharedObservedAt}
                    initiallyExpanded={
                      key === matches[0].key && sourceGroup(item) === "failures"
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 py-4">
          <p role="status">{t("no-matches")}</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("")
              setFilter("all")
            }}
          >
            {t("clear-filters")}
          </Button>
        </div>
      )}
      {matches.length > limit && (
        <Button
          variant="outline"
          className="min-h-11 self-start"
          onClick={() => setLimit((value) => value + 20)}
        >
          {t("show-more", { count: Math.min(20, matches.length - limit) })}
        </Button>
      )}
    </div>
  )
}

function CheckoutDetails({ checkout }: { checkout?: Checkout | null }) {
  if (!checkout) {
    return null
  }
  return (
    <details
      className={cn(
        detailsClass,
        "mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]",
      )}
    >
      <DisclosureTitle>{t("packaging-checkout")}</DisclosureTitle>
      <div className="flex flex-col gap-1 pb-3">
        {checkout.branch && <p dir="ltr">{checkout.branch}</p>}
        <p dir="ltr">{checkout.commit ?? t("unknown-revision")}</p>
        <p>
          {t(
            checkout.dirty === true
              ? "checkout-dirty"
              : checkout.dirty === false
                ? "checkout-clean"
                : "checkout-unknown",
          )}
        </p>
      </div>
    </details>
  )
}

function SubmoduleUpdates({ updates }: { updates?: Submodule[] | null }) {
  if (!updates?.length) {
    return null
  }

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-2">
      <h4 className="text-sm font-medium">{t("submodule-updates")}</h4>
      <ul className="divide-y divide-border border-s-2 border-border ps-3">
        {updates.map((update) => (
          <li key={update.path} className="min-w-0 py-3 first:pt-1 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className="min-w-0 font-medium [overflow-wrap:anywhere]"
                dir="ltr"
              >
                {update.path}
              </p>
              <Badge
                variant={update.status === "blocked" ? "outline" : "secondary"}
              >
                {t(`status-${update.status}`)}
              </Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {(["current", "candidate"] as const).map((revision) => (
                <div key={revision} className="min-w-0">
                  <dt className="mb-1 text-muted-foreground">
                    {t(`submodule-${revision}`)}
                  </dt>
                  <dd>
                    <code dir="ltr" title={update[revision]}>
                      <span aria-hidden>{update[revision].slice(0, 12)}</span>
                      <span className="sr-only">{update[revision]}</span>
                    </code>
                  </dd>
                </div>
              ))}
            </dl>
            <details className={cn(detailsClass, "mt-1 text-xs")}>
              <DisclosureTitle>
                {t("submodule-files", { count: update.files.length })}
              </DisclosureTitle>
              <ul className="flex flex-col gap-2 pb-2 text-muted-foreground">
                {update.files.map((file) => (
                  <li key={file} dir="ltr" className="[overflow-wrap:anywhere]">
                    {file}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReportDetails({ data }: { data: Health }) {
  const date = useCheckDate()
  return (
    <div className="divide-y divide-border border-t border-border">
      {!!data.diagnostics?.length && (
        <details className={detailsClass}>
          <DisclosureTitle>
            <span className="font-medium">{t("diagnostics")}</span>
            <span className="ms-2 text-muted-foreground">
              ({data.diagnostics.length})
            </span>
          </DisclosureTitle>
          <div className="flex flex-col gap-4 pb-5">
            <p className="max-w-prose text-muted-foreground">
              {t("diagnostics-note")}
            </p>
            <ul className="flex flex-col gap-4">
              {data.diagnostics.map((item, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-2 border-s-2 border-border ps-4 [overflow-wrap:anywhere]"
                >
                  <p className="font-semibold">{item.error.type}</p>
                  <p className="max-w-prose">{item.error.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.branch ?? t("default-branch")}.{" "}
                    {t("diagnostic-count", { count: item.observations ?? 0 })}
                  </p>
                  <a
                    className="inline-flex min-h-11 items-center self-start underline underline-offset-4"
                    href={item.run_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("observed", { date: date(item.last_seen_at) })}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      <details className={detailsClass}>
        <DisclosureTitle>
          <span className="font-medium">{t("history")}</span>
        </DisclosureTitle>
        <div className="flex flex-col gap-4 pb-5">
          <p className="max-w-prose text-muted-foreground">
            {t("delivery-note")}
          </p>
          <ol className="flex flex-col divide-y divide-border">
            {data.history?.map((run, index) => (
              <li
                key={index}
                className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div className="min-w-0">
                  <a
                    className="inline-flex min-h-11 items-center self-start underline underline-offset-4"
                    href={run.run_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <time dateTime={run.observed_at}>
                      {date(run.observed_at)}
                    </time>
                  </a>
                  {run.checker && (
                    <details
                      className={cn(
                        detailsClass,
                        "text-xs text-muted-foreground [overflow-wrap:anywhere]",
                      )}
                    >
                      <DisclosureTitle>{t("checker-revision")}</DisclosureTitle>
                      {run.checker.revision ? (
                        <RunLink
                          url={`https://github.com/flathub-infra/flatpak-external-data-checker/commit/${run.checker.revision}`}
                        >
                          <span title={run.checker.revision}>
                            {run.checker.revision.slice(0, 12)}
                          </span>
                        </RunLink>
                      ) : (
                        <p>{t("unknown-revision")}</p>
                      )}
                      <p>{t(`checker-source-${run.checker.source}`)}</p>
                      {run.checker.source === "git" && (
                        <p>
                          {t(
                            run.checker.dirty
                              ? "checkout-dirty"
                              : "checkout-clean",
                          )}
                        </p>
                      )}
                    </details>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                  {run.branches.map((branch, index) => (
                    <div key={index} className="[overflow-wrap:anywhere]">
                      <p className="font-medium">
                        {branch.branch ?? t("default-branch")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.has(`report-${branch.status}`)
                          ? t(`report-${branch.status}`)
                          : branch.status}
                        {branch.delivery && (
                          <>
                            {" "}
                            /{" "}
                            {t.has(`delivery-${branch.delivery}`)
                              ? t(`delivery-${branch.delivery}`)
                              : branch.delivery}
                          </>
                        )}
                      </p>
                      {branch.pull_request && (
                        <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs">
                          <p>{t(`pr-${branch.pull_request.outcome}`)}</p>
                          {/^https?:\/\//i.test(branch.pull_request.url) && (
                            <RunLink url={branch.pull_request.url}>
                              {branch.pull_request.url.match(
                                /\/pull\/(\d+)$/,
                              )?.[1]
                                ? t("pull-request-number", {
                                    number:
                                      branch.pull_request.url.match(
                                        /\/pull\/(\d+)$/,
                                      )![1],
                                  })
                                : t("view-pull-request")}
                            </RunLink>
                          )}
                        </div>
                      )}
                      <CheckoutDetails checkout={branch.checkout} />
                      <SubmoduleUpdates updates={branch.submodules} />
                      {branch.skip_reason && (
                        <p className="text-xs text-muted-foreground">
                          {branch.skip_reason === "runtime-end-of-life"
                            ? t("runtime-eol-skip")
                            : branch.skip_reason === "end-of-life"
                              ? t("eol-skip")
                              : branch.skip_reason}
                        </p>
                      )}
                      {!!branch.runtime_eol?.length && (
                        <ul className="mt-2 flex flex-col gap-2 text-xs">
                          {branch.runtime_eol.map((runtime) => (
                            <li key={runtime.ref}>
                              <p dir="ltr">{runtime.ref}</p>
                              {runtime.end_of_life && (
                                <p>{runtime.end_of_life}</p>
                              )}
                              {runtime.end_of_life_rebase && (
                                <p>
                                  {t("runtime-replacement", {
                                    ref: runtime.end_of_life_rebase,
                                  })}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </details>
      <details className={detailsClass}>
        <DisclosureTitle>{t("about-reports")}</DisclosureTitle>
        <div className="flex max-w-prose flex-col gap-3 pb-5 text-muted-foreground">
          <p>{t("coverage")}</p>
          <p>{t("semantics")}</p>
          <p>{t("unchecked-note")}</p>
        </div>
      </details>
    </div>
  )
}

export default function CheckerHealth({ appId }: { appId: string }) {
  const date = useCheckDate()
  const query = useGetCheckerHealthAppsAppIdCheckerHealthGet(appId)
  const data = query.data?.data
  const latestRun = data?.history?.[0]

  return (
    <section
      className="flex min-w-0 flex-col gap-6 border-t border-border pt-7 text-sm"
      aria-label={t("title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight">{t("title")}</h3>
        {!query.isPending && !query.isError && latestRun && (
          <RunLink url={latestRun.run_url} prominent>
            {t("latest-run")}
          </RunLink>
        )}
      </div>
      {!query.isPending && !query.isError && (
        <CheckerSelection data={data?.selection} />
      )}
      {query.isPending ? (
        <div
          role="status"
          aria-label={t("loading")}
          className="flex flex-col gap-4"
        >
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-prose" role="status">
            {t("unavailable")}
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw data-icon="inline-start" aria-hidden />
            {t("reload")}
          </Button>
        </div>
      ) : !data?.last_report_at ? (
        <div className="flex max-w-prose flex-col gap-3">
          <p role="status">{t("unknown")}</p>
          <p className="text-muted-foreground">{t("unknown-next-step")}</p>
          <a
            className="inline-flex min-h-11 items-center self-start underline underline-offset-4"
            href="https://github.com/flathub/flathub/actions"
            target="_blank"
            rel="noreferrer"
          >
            {t("browse-runs")}
          </a>
        </div>
      ) : (
        <>
          {!!data.sources?.length && <SourceSummary sources={data.sources} />}
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <dt>
                {t(
                  data.last_report_at === data.last_check_at
                    ? "last-report-and-check"
                    : "last-report",
                )}
              </dt>
              <dd>
                <time dateTime={data.last_report_at}>
                  {date(data.last_report_at)}
                </time>
              </dd>
            </div>
            {data.last_report_at !== data.last_check_at && (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <dt>{t("last-check")}</dt>
                <dd>
                  {data.last_check_at ? (
                    <time dateTime={data.last_check_at}>
                      {date(data.last_check_at)}
                    </time>
                  ) : (
                    t("unknown-check")
                  )}
                </dd>
              </div>
            )}
          </dl>
          {data.sources?.length ? (
            <SourceList
              key={appId}
              sources={data.sources}
              reportAt={data.last_report_at}
            />
          ) : (
            <p>{t("no-sources")}</p>
          )}
          <ReportDetails data={data} />
        </>
      )}
    </section>
  )
}
