"use client"

import { useId, useMemo, useState } from "react"
import { useLocale } from "next-intl"
import { BarChartIcon, CheckIcon } from "@radix-ui/react-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildPermissionInventory,
  getPermissionPercentage,
  permissionGroupLabel,
  permissionKey,
  type PermissionStatsWindow,
} from "./permission-stats"
import PermissionStatsSelect from "./PermissionStatsSelect"
import PermissionStatsTrend from "./PermissionStatsTrend"

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
  const locale = useLocale()
  const id = useId()
  const [group, setGroup] = useState("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("count-desc")
  const [currentOnly, setCurrentOnly] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const inventory = useMemo(
    () => buildPermissionInventory(window?.snapshots ?? []),
    [window],
  )
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>()
    for (const entry of inventory) {
      const key = permissionKey(entry.groupPath)
      map.set(key, {
        label: permissionGroupLabel(entry.groupPath),
        count: (map.get(key)?.count ?? 0) + 1,
      })
    }
    return [...map].sort((a, b) => a[1].label.localeCompare(b[1].label))
  }, [inventory])
  const rows = useMemo(() => {
    const needle = query.toLowerCase().trim()
    return inventory
      .filter(
        (entry) =>
          (group === "all" || permissionKey(entry.groupPath) === group) &&
          (!currentOnly || !entry.historicalOnly) &&
          (!needle ||
            (entry.value + " " + permissionGroupLabel(entry.groupPath))
              .toLowerCase()
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
  }, [inventory, group, currentOnly, query, sort])
  const active =
    inventory.find((entry) => permissionKey(entry.path) === selected) ??
    rows[0] ??
    inventory[0]
  const latest = window?.snapshots.at(-1)
  const number = new Intl.NumberFormat(locale)
  const percentage = (count: number, total: number) => {
    const value = getPermissionPercentage(count, total)
    if (value !== null && value > 0 && value < 0.1) return "<0.1%"
    return value === null
      ? "Unavailable"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          value,
        ) + "%"
  }
  const groupButtons = [
    ["all", { label: "All permission sets", count: inventory.length }],
    ...groups,
  ] as [string, { label: string; count: number }][]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">
            App permissions
          </h1>
          <div className="text-sm text-muted-foreground">
            Explore sandbox permissions and their monthly usage across Flathub
            apps.
          </div>
        </div>
        <PermissionStatsSelect
          label="History"
          ariaLabel="History period"
          value={String(months)}
          onValueChange={(value) => onMonthsChange(Number(value) as 6 | 12)}
          options={[
            { value: "6", label: "6 months" },
            { value: "12", label: "12 months" },
          ]}
        />
      </header>
      {isLoading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">Loading permission snapshots…</span>
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Permission statistics could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Please try fetching the snapshots again.</span>
            <Button variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : !latest ? (
        <Card>
          <CardHeader>
            <CardTitle>No snapshots available</CardTitle>
            <CardDescription>
              There are no permission snapshots for this period. Try a longer
              history window.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Eligible apps",
                value: number.format(latest.eligible_apps),
                detail: `Latest snapshot · ${latest.snapshot_date}`,
              },
              {
                label: "Apps with stable metadata",
                value: number.format(latest.apps_with_stable_metadata),
                detail: `${percentage(latest.apps_with_stable_metadata, latest.eligible_apps)} metadata coverage`,
              },
              {
                label: "Permission values in this period",
                value: number.format(inventory.length),
                detail: `${groups.length} sets · includes historical values`,
              },
            ].map((stat) => (
              <Card key={stat.label} className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardDescription>{stat.label}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 px-4">
                  <div className="text-2xl font-bold tabular-nums">
                    {stat.value}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {stat.detail}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          {!inventory.length ? (
            <Card>
              <CardHeader>
                <CardTitle>No permission values recorded</CardTitle>
                <CardDescription>
                  No permission values recorded in these snapshots.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-[224px_minmax(0,1fr)]">
              <aside aria-label="Permission sets">
                <Card className="gap-3 py-4">
                  <CardHeader className="px-4">
                    <CardTitle>
                      <h2>Permission sets</h2>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2">
                    <nav
                      className="flex flex-wrap gap-1 xl:flex-col"
                      aria-label="Filter by permission set"
                    >
                      {groupButtons.map(([key, item]) => (
                        <Button
                          key={key}
                          variant={group === key ? "secondary" : "ghost"}
                          aria-pressed={group === key}
                          onClick={() => {
                            setGroup(key)
                            setSelected(null)
                          }}
                          className="h-auto justify-between gap-2 px-3 py-2"
                        >
                          <span className="min-w-0 whitespace-normal text-start">
                            {item.label}
                          </span>
                          <span className="text-xs tabular-nums">
                            {number.format(item.count)}
                          </span>
                        </Button>
                      ))}
                    </nav>
                  </CardContent>
                </Card>
              </aside>
              <div className="flex min-w-0 flex-col gap-5">
                <section aria-label="Permission inventory">
                  <Card className="gap-4 py-4">
                    <CardHeader className="gap-3 px-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle>
                          <h2>Permission inventory</h2>
                        </CardTitle>
                        <CardDescription>
                          {number.format(rows.length)} matching values · Current
                          counts {latest.snapshot_date}
                        </CardDescription>
                      </div>
                      <div
                        className="flex flex-wrap items-center gap-3"
                        role="group"
                        aria-label="Inventory filters"
                      >
                        <div className="min-w-40 flex-1">
                          <Input
                            aria-label="Search permissions"
                            type="search"
                            placeholder="Search permission names and sets…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <PermissionStatsSelect
                          label="Sort"
                          ariaLabel="Sort permissions"
                          value={sort}
                          onValueChange={setSort}
                          options={[
                            { value: "count-desc", label: "Most common first" },
                            { value: "count-asc", label: "Least common first" },
                            { value: "name", label: "Name A–Z" },
                          ]}
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${id}-current`}
                            checked={currentOnly}
                            onCheckedChange={(checked) =>
                              setCurrentOnly(checked === true)
                            }
                          />
                          <label htmlFor={`${id}-current`} className="text-xs">
                            Current snapshot only
                          </label>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-0">
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table
                          className="table-fixed"
                          aria-label="Permission counts"
                        >
                          <TableHeader>
                            <TableRow>
                              <TableHead className="ps-4">Permission</TableHead>
                              <TableHead className="w-16 text-end sm:w-20">
                                Apps
                              </TableHead>
                              <TableHead className="w-20 whitespace-normal text-end sm:w-40">
                                Recorded share
                              </TableHead>
                              <TableHead className="w-12 pe-4 sm:w-28">
                                <span className="sr-only">View trend</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.length ? (
                              rows.map((entry) => (
                                <TableRow
                                  key={permissionKey(entry.path)}
                                  data-state={
                                    active === entry ? "selected" : undefined
                                  }
                                >
                                  <TableCell className="ps-4">
                                    <div className="flex min-w-0 flex-col gap-1">
                                      <span className="break-all whitespace-normal font-mono text-xs">
                                        {entry.value}
                                      </span>
                                      <span className="whitespace-normal text-xs text-muted-foreground">
                                        {permissionGroupLabel(entry.groupPath)}
                                      </span>
                                      {entry.historicalOnly ? (
                                        <Badge
                                          variant="outline"
                                          className="w-fit"
                                        >
                                          Historical only
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-end font-medium tabular-nums">
                                    {number.format(entry.count)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-end gap-3">
                                      <span
                                        className="hidden h-1 w-16 overflow-hidden rounded-full bg-muted sm:block"
                                        aria-hidden="true"
                                      >
                                        <span
                                          className="block h-full bg-primary"
                                          style={{
                                            width: `${Math.min(100, getPermissionPercentage(entry.count, latest.eligible_apps) ?? 0)}%`,
                                          }}
                                        />
                                      </span>
                                      <span className="text-end text-xs tabular-nums">
                                        {percentage(
                                          entry.count,
                                          latest.eligible_apps,
                                        )}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="pe-4 text-end">
                                    <Button
                                      size="sm"
                                      variant={
                                        active === entry ? "default" : "ghost"
                                      }
                                      aria-label={`View trend for ${entry.value}`}
                                      aria-controls={`${id}-trend`}
                                      aria-pressed={active === entry}
                                      onClick={() =>
                                        setSelected(permissionKey(entry.path))
                                      }
                                      className="px-2"
                                    >
                                      {active === entry ? (
                                        <CheckIcon data-icon="inline-start" />
                                      ) : (
                                        <BarChartIcon data-icon="inline-start" />
                                      )}
                                      <span className="hidden sm:inline">
                                        {active === entry
                                          ? "Viewing"
                                          : "View trend"}
                                      </span>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="py-8 text-center"
                                >
                                  <span className="text-sm text-muted-foreground">
                                    No permissions match these filters.
                                  </span>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </section>
                {window ? (
                  <PermissionStatsTrend
                    id={`${id}-trend`}
                    window={window}
                    entry={active}
                  />
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
