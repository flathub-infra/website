"use client"

import { useId, useMemo, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { ChevronDownIcon, MixerHorizontalIcon } from "@radix-ui/react-icons"
import StatisticsHeader from "src/components/StatisticsHeader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  buildPermissionInventory,
  getPermissionPercentage,
  permissionGroupLabel,
  permissionKey,
  type PermissionStatsWindow,
} from "./permission-stats"
import PermissionStatsSelect from "./PermissionStatsSelect"
import PermissionStatsTrend from "./PermissionStatsTrend"

const INVENTORY_PAGE_SIZE = 10

export interface PermissionStatsDashboardProps {
  window?: PermissionStatsWindow
  months: 6 | 12
  onMonthsChange: (months: 6 | 12) => void
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

export default function PermissionStatsDashboard({
  window,
  months,
  onMonthsChange,
  isLoading,
  isError,
  onRetry,
}: PermissionStatsDashboardProps) {
  const t = useTranslations("permission-statistics")
  const common = useTranslations()
  const format = useFormatter()
  const id = useId()
  const [group, setGroup] = useState("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("count-desc")
  const [currentOnly, setCurrentOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [visibleRows, setVisibleRows] = useState(INVENTORY_PAGE_SIZE)
  const inventory = useMemo(
    () => buildPermissionInventory(window?.snapshots ?? []),
    [window],
  )
  const groups = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of inventory) {
      map.set(
        permissionKey(entry.groupPath),
        permissionGroupLabel(entry.groupPath, (key) => t(`groups.${key}`)),
      )
    }
    return [...map].sort((a, b) => a[1].localeCompare(b[1]))
  }, [inventory, t])
  const rows = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim()
    return inventory
      .filter(
        (entry) =>
          (group === "all" || permissionKey(entry.groupPath) === group) &&
          (!currentOnly || !entry.historicalOnly) &&
          (!needle ||
            `${entry.value} ${permissionGroupLabel(entry.groupPath, (key) => t(`groups.${key}`))}`
              .toLocaleLowerCase()
              .includes(needle)),
      )
      .sort(
        (a, b) =>
          (sort === "name"
            ? a.value.localeCompare(b.value)
            : sort === "count-asc"
              ? a.count - b.count
              : b.count - a.count) ||
          permissionKey(a.path).localeCompare(permissionKey(b.path)),
      )
  }, [inventory, group, currentOnly, query, sort, t])
  const latest = window?.snapshots.at(-1)
  const activeFilterCount =
    Number(group !== "all") +
    Number(currentOnly) +
    Number(sort !== "count-desc")
  const resetFilters = () => {
    setQuery("")
    setGroup("all")
    setSort("count-desc")
    setCurrentOnly(false)
    setSelected(null)
    setVisibleRows(INVENTORY_PAGE_SIZE)
  }
  const percentage = (count: number) => {
    const value = getPermissionPercentage(count, latest?.eligible_apps ?? 0)
    if (value === null) {
      return t("unavailable")
    }
    if (value > 0 && value < 0.1) {
      return t("less-than", {
        value: format.number(0.001, {
          style: "percent",
          maximumFractionDigits: 1,
        }),
      })
    }
    return format.number(value / 100, {
      style: "percent",
      maximumFractionDigits: 1,
    })
  }

  return (
    <div className="permission-statistics max-w-11/12 mx-auto mt-12 flex w-11/12 flex-col gap-6 pb-10 sm:gap-8 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <StatisticsHeader active="permissions" />
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("description")}
          </p>
          {latest && !isLoading && !isError ? (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-muted-foreground sm:text-sm">
              <span>
                <strong className="font-mono font-semibold text-foreground">
                  {format.number(latest.eligible_apps)}
                </strong>{" "}
                {t("eligible")}
              </span>
              <span>
                <strong className="font-mono font-semibold text-foreground">
                  {format.number(inventory.length)}
                </strong>{" "}
                {t("values")}
              </span>
              <span>
                {t("latest-snapshot", {
                  date: format.dateTime(
                    new Date(latest.snapshot_date + "T00:00:00Z"),
                    { dateStyle: "medium", timeZone: "UTC" },
                  ),
                })}
              </span>
            </div>
          ) : null}
        </div>
        <PermissionStatsSelect
          label={t("history")}
          ariaLabel={t("history-period")}
          value={String(months)}
          onValueChange={(value) => onMonthsChange(Number(value) as 6 | 12)}
          options={[
            { value: "6", label: t("months", { count: 6 }) },
            { value: "12", label: t("months", { count: 12 }) },
          ]}
        />
      </header>
      {isLoading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("loading")}</span>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("error")}</AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={onRetry}>
              {common("status-retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : !latest ? (
        <Alert>
          <AlertTitle>{t("empty")}</AlertTitle>
          <AlertDescription>{t("empty-description")}</AlertDescription>
        </Alert>
      ) : !inventory.length ? (
        <Alert>
          <AlertTitle>{t("no-values")}</AlertTitle>
        </Alert>
      ) : (
        <section
          aria-label={t("inventory")}
          className="flex min-w-0 flex-col gap-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 gap-2">
              <Input
                aria-label={t("search")}
                type="search"
                placeholder={t("search")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(null)
                  setVisibleRows(INVENTORY_PAGE_SIZE)
                }}
                className="min-w-0 flex-1"
              />
              <Button
                variant="outline"
                aria-expanded={filtersOpen}
                aria-controls={`${id}-filters`}
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="sm:hidden"
              >
                <MixerHorizontalIcon data-icon="inline-start" />
                {common("filters")}
                {activeFilterCount
                  ? ` (${format.number(activeFilterCount)})`
                  : ""}
              </Button>
            </div>
            <div
              id={`${id}-filters`}
              className={cn(
                "flex-wrap items-center gap-3",
                filtersOpen ? "flex" : "hidden sm:flex",
              )}
            >
              <PermissionStatsSelect
                label={t("sets")}
                hideLabel
                ariaLabel={t("filter-sets")}
                value={group}
                onValueChange={(value) => {
                  setGroup(value)
                  setSelected(null)
                  setVisibleRows(INVENTORY_PAGE_SIZE)
                }}
                options={[
                  { value: "all", label: t("all-sets") },
                  ...groups.map(([value, label]) => ({ value, label })),
                ]}
              />
              <PermissionStatsSelect
                label={t("sort")}
                hideLabel
                value={sort}
                onValueChange={(value) => {
                  setSort(value)
                  setSelected(null)
                  setVisibleRows(INVENTORY_PAGE_SIZE)
                }}
                options={[
                  { value: "count-desc", label: t("most-common") },
                  { value: "count-asc", label: t("least-common") },
                  { value: "name", label: common("name") },
                ]}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-current`}
                  checked={currentOnly}
                  onCheckedChange={(checked) => {
                    setCurrentOnly(checked === true)
                    setSelected(null)
                    setVisibleRows(INVENTORY_PAGE_SIZE)
                  }}
                />
                <label htmlFor={`${id}-current`} className="text-xs">
                  {t("current-only")}
                </label>
              </div>
              {activeFilterCount || query ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  {t("reset-filters")}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span aria-live="polite">
              {t("matching", { count: rows.length })}
            </span>
            <span>{t("expand-history")}</span>
          </div>
          <div
            className="permission-list-heading hidden sm:grid"
            aria-hidden="true"
          >
            <span>{t("permission")}</span>
            <span className="text-end">{common("apps")}</span>
            <span className="text-end">{t("share")}</span>
            <span />
          </div>
          <ul aria-label={t("counts")} className="permission-list">
            {rows.slice(0, visibleRows).map((entry, index) => {
              const key = permissionKey(entry.path)
              const expanded = selected === key
              const trendId = `${id}-trend-${index}`
              return (
                <li
                  key={key}
                  className={cn(
                    "permission-list-item",
                    expanded && "permission-list-item-open",
                  )}
                >
                  <button
                    type="button"
                    className="permission-list-button"
                    aria-label={t("view-trend-for", {
                      permission: entry.value,
                    })}
                    aria-expanded={expanded}
                    aria-describedby={`${trendId}-context ${trendId}-count ${trendId}-share`}
                    aria-controls={expanded ? trendId : undefined}
                    onClick={() => setSelected(expanded ? null : key)}
                  >
                    <span className="flex min-w-0 flex-col gap-1 text-start">
                      <span className="break-all font-mono text-sm font-semibold">
                        {entry.value}
                      </span>
                      <span
                        id={`${trendId}-context`}
                        className="flex flex-col gap-1"
                      >
                        <span className="text-xs text-muted-foreground">
                          {permissionGroupLabel(entry.groupPath, (key) =>
                            t(`groups.${key}`),
                          )}
                        </span>
                        {entry.historicalOnly ? (
                          <Badge variant="outline" className="w-fit">
                            {t("historical")}
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                    <span
                      id={`${trendId}-count`}
                      className="permission-list-count font-mono text-sm tabular-nums"
                    >
                      <span className="sr-only">{common("apps")} </span>
                      {format.number(entry.count)}
                    </span>
                    <span
                      id={`${trendId}-share`}
                      className="permission-list-share"
                    >
                      <span
                        className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-full bg-primary"
                          style={{
                            width: `${Math.min(100, getPermissionPercentage(entry.count, latest.eligible_apps) ?? 0)}%`,
                          }}
                        />
                      </span>
                      <span className="text-xs tabular-nums">
                        <span className="sr-only">{t("share")} </span>
                        {percentage(entry.count)}
                      </span>
                    </span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn(
                        "permission-list-chevron",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded && window ? (
                    <PermissionStatsTrend
                      id={trendId}
                      window={window}
                      entry={entry}
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
          {!rows.length ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-muted-foreground">{t("no-matches")}</p>
              <Button variant="outline" onClick={resetFilters}>
                {t("reset-filters")}
              </Button>
            </div>
          ) : null}
          {rows.length > visibleRows ? (
            <Button
              variant="outline"
              onClick={() =>
                setVisibleRows((count) =>
                  Math.min(count + INVENTORY_PAGE_SIZE, rows.length),
                )
              }
              className="self-center"
            >
              {t("show-more")}
            </Button>
          ) : null}
        </section>
      )}
      <details className="border-t border-border pt-4 text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
          {t("methodology")}
        </summary>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          {t("methodology-description")}
        </p>
      </details>
    </div>
  )
}
