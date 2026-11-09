"use client"

import { useFormatter } from "next-intl"
import { checkerHealthText as t } from "./CheckerHealth.messages"
import { useId, useState, type ReactNode } from "react"
import { ChevronDown, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useGetCheckerHealthAppsAppIdCheckerHealthGet } from "src/codegen/checker-health/checker-health"
import type {
  CheckerHealth as Health,
  CheckerSourceHealth,
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
}: {
  observation: CheckerSourceHealth
  initiallyExpanded: boolean
}) {
  const date = useCheckDate()
  const source = observation.source
  const unresolved = Boolean(observation.failures)
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [rawExpanded, setRawExpanded] = useState(false)
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

  return (
    <li className="min-w-0 border-t border-border">
      <details
        className={detailsClass}
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary className={disclosureClass}>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-semibold [overflow-wrap:anywhere]">
              {source.module || source.manifest}
            </span>
            <span className="flex flex-col gap-x-3 gap-y-1 text-xs text-muted-foreground [overflow-wrap:anywhere] sm:flex-row sm:flex-wrap">
              <span>{observation.branch ?? t("default-branch")}</span>
              {source.module && <span>{source.manifest}</span>}
            </span>
          </span>
          <Badge
            variant={
              unresolved || source.status === "failed"
                ? "destructive"
                : "static"
            }
            className="max-w-[45%] shrink-0 text-center"
          >
            {t(`status-${status}`)}
          </Badge>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </summary>
        {expanded && (
          <div className="flex min-w-0 flex-col gap-2 pb-3">
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
              {unresolved && observation.last_failure_at ? (
                <span className="text-xs text-muted-foreground sm:ms-auto">
                  {t("last-failure-time", {
                    date: date(observation.last_failure_at),
                  })}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground sm:ms-auto">
                  {t("observed-time", { date: date(observation.observed_at) })}
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
            </div>
            <details
              className={detailsClass}
              onToggle={(event) => setRawExpanded(event.currentTarget.open)}
            >
              <DisclosureTitle>{t("source-details")}</DisclosureTitle>
              <dl className="grid min-w-0 grid-cols-1 gap-3 pb-4 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{t("location")}</dt>
                  <dd className="mt-1 [overflow-wrap:anywhere]" dir="ltr">
                    {source.manifest}
                    <br />
                    {source.source_pointer === null
                      ? t("unknown-location")
                      : source.source_pointer || t("document-root")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("observed-label")}
                  </dt>
                  <dd className="mt-1">
                    <time dateTime={observation.observed_at}>
                      {date(observation.observed_at)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("latest-result")}
                  </dt>
                  <dd className="mt-1">{t(`status-${source.status}`)}</dd>
                </div>
                {source.checker_type && (
                  <div>
                    <dt className="text-muted-foreground">{t("checker")}</dt>
                    <dd className="mt-1">{source.checker_type}</dd>
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
            </details>
          </div>
        )}
      </details>
    </li>
  )
}

function SourceList({ sources }: { sources: CheckerSourceHealth[] }) {
  const format = useFormatter()
  const id = useId()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [limit, setLimit] = useState(10)
  const groups = ["failures", "updates", "recovered", "checked", "unchecked"]
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

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold">{t("sources")}</h4>
        <p className="text-xs text-muted-foreground" role="status">
          {t("source-count", {
            shown: Math.min(limit, matches.length),
            total: matches.length,
          })}
        </p>
      </div>
      {(sources.length > 3 || search || filter !== "all") && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-search`}
              className="text-xs text-muted-foreground"
            >
              {t("find-source")}
            </label>
            <Input
              id={`${id}-search`}
              type="search"
              value={search}
              placeholder={t("search-placeholder")}
              className="min-h-11"
              onChange={(event) => {
                setSearch(event.target.value)
                setLimit(10)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-filter`}
              className="text-xs text-muted-foreground"
            >
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
                  {t(`filter-${group}`)} (
                  {format.number(
                    sources.filter((item) => sourceGroup(item) === group)
                      .length,
                  )}
                  )
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {matches.length ? (
        <ul>
          {matches.slice(0, limit).map(({ item, key }, index) => (
            <Source
              key={key}
              observation={item}
              initiallyExpanded={
                index === 0 && sourceGroup(item) === "failures"
              }
            />
          ))}
        </ul>
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

function ReportDetails({ data }: { data: Health }) {
  const date = useCheckDate()
  return (
    <div className="divide-y divide-border border-y border-border">
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
                  className="flex flex-col gap-2 [overflow-wrap:anywhere]"
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
                <div className="flex flex-col gap-2">
                  {run.branches.map((branch, index) => (
                    <div key={index} className="[overflow-wrap:anywhere]">
                      <p>{branch.branch ?? t("default-branch")}</p>
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
                      {branch.skip_reason && (
                        <p className="text-xs text-muted-foreground">
                          {branch.skip_reason === "runtime-end-of-life"
                            ? t("runtime-eol-skip")
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
      className="flex min-w-0 flex-col gap-5 border-t border-border py-6 text-sm"
      aria-label={t("title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t("title")}</h3>
        {!query.isPending && !query.isError && latestRun && (
          <RunLink url={latestRun.run_url} prominent>
            {t("latest-run")}
          </RunLink>
        )}
      </div>
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
          <dl className="flex flex-wrap gap-x-10 gap-y-3 rounded-lg bg-muted px-4 py-3">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("last-report")}
              </dt>
              <dd className="mt-1 font-medium">
                <time dateTime={data.last_report_at}>
                  {date(data.last_report_at)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("last-check")}
              </dt>
              <dd className="mt-1 font-medium">
                {data.last_check_at ? (
                  <time dateTime={data.last_check_at}>
                    {date(data.last_check_at)}
                  </time>
                ) : (
                  t("unknown-check")
                )}
              </dd>
            </div>
          </dl>
          <p className="max-w-prose text-xs text-muted-foreground">
            {t("observation-note")}
          </p>
          {data.sources?.length ? (
            <SourceList key={appId} sources={data.sources} />
          ) : (
            <p>{t("no-sources")}</p>
          )}
          <ReportDetails data={data} />
        </>
      )}
    </section>
  )
}
