"use client"

import { useState } from "react"
import { useLocale } from "next-intl"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildMonthlyPermissionTrend,
  permissionGroupLabel,
  type PermissionEntry,
  type PermissionStatsWindow,
} from "./permission-stats"
import PermissionStatsSelect from "./PermissionStatsSelect"

const chartConfig = {
  count: { label: "App count", color: "oklch(var(--primary))" },
  percentage: { label: "Recorded share", color: "oklch(var(--primary))" },
} satisfies ChartConfig

export default function PermissionStatsTrend({
  id,
  window,
  entry,
}: {
  id?: string
  window: PermissionStatsWindow
  entry?: PermissionEntry
}) {
  const locale = useLocale()
  const [metric, setMetric] = useState<"count" | "percentage">("count")
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const monthLabel = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(value + "-01T00:00:00Z"))
  const points = entry ? buildMonthlyPermissionTrend(window, entry.path) : []
  return (
    <section id={id} aria-label="Monthly adoption trend">
      <Card className="gap-4 py-4">
        <CardHeader className="gap-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              <h2>Monthly adoption trend</h2>
            </CardTitle>
            <PermissionStatsSelect
              label="Measure"
              value={metric}
              onValueChange={(value) => setMetric(value as typeof metric)}
              options={[
                { value: "count", label: "App count" },
                { value: "percentage", label: "Share of eligible apps" },
              ]}
              disabled={!entry || window.snapshots.length < 2}
            />
          </div>
          {entry ? (
            <div className="flex flex-col gap-1" aria-live="polite">
              <span className="text-xs text-muted-foreground">
                Selected permission
              </span>
              <div className="break-all font-mono text-sm font-medium">
                {entry.value}
              </div>
              <CardDescription>
                {permissionGroupLabel(entry.groupPath)}
              </CardDescription>
            </div>
          ) : (
            <CardDescription>
              Select a permission to inspect its history.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="px-4">
          {window.snapshots.length < 2 ? (
            <Alert role="status">
              <AlertTitle>Trend history not available yet</AlertTitle>
              <AlertDescription>
                Only one monthly snapshot is available. The current counts are
                shown above.
              </AlertDescription>
            </Alert>
          ) : entry ? (
            <div className="flex flex-col gap-4">
              <ChartContainer
                config={chartConfig}
                className="h-60 w-full aspect-auto"
                role="img"
                aria-label={`Monthly ${metric === "count" ? "app count" : "recorded permission share"} for ${entry.value}`}
              >
                <LineChart
                  accessibilityLayer
                  data={points}
                  margin={{ top: 10, right: 12, left: 0, bottom: 5 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    width={55}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      number.format(value) +
                      (metric === "percentage" ? "%" : "")
                    }
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      const point = payload?.[0]?.payload as
                        (typeof points)[number] | undefined
                      return active && point ? (
                        <div className="flex flex-col gap-2 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                          <strong>{point.snapshotDate ?? "No snapshot"}</strong>
                          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
                            <dt>Apps</dt>
                            <dd className="text-end tabular-nums">
                              {point.count === null
                                ? "Unavailable"
                                : number.format(point.count)}
                            </dd>
                            <dt>Recorded share</dt>
                            <dd className="text-end tabular-nums">
                              {point.percentage === null
                                ? "Unavailable"
                                : number.format(point.percentage) + "%"}
                            </dd>
                            <dt>Metadata coverage</dt>
                            <dd className="text-end tabular-nums">
                              {point.metadataCoverage === null
                                ? "Unavailable"
                                : number.format(point.metadataCoverage) + "%"}
                            </dd>
                          </dl>
                          {point.month === window.end_month ? (
                            <span className="text-muted-foreground">
                              Latest available observation
                            </span>
                          ) : null}
                        </div>
                      ) : null
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey={metric}
                    stroke={`var(--color-${metric})`}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Snapshot dates and metadata coverage
                </summary>
                <Table className="mt-2" aria-label="Monthly observations">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Observed</TableHead>
                      <TableHead className="text-end">Apps</TableHead>
                      <TableHead className="text-end">Coverage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {points.map((point) => (
                      <TableRow key={point.month}>
                        <TableCell>{monthLabel(point.month)}</TableCell>
                        <TableCell>
                          {point.snapshotDate ?? "No snapshot"}
                          {point.month === window.end_month &&
                          point.snapshotDate ? (
                            <span className="ms-2 text-xs text-muted-foreground">
                              Latest available
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {point.count === null
                            ? "—"
                            : number.format(point.count)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {point.metadataCoverage === null
                            ? "—"
                            : number.format(point.metadataCoverage) + "%"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </details>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="px-4">
          <span className="text-xs leading-relaxed text-muted-foreground">
            Shares are the percentage of eligible apps with this recorded
            permission. Counts cover apps with stable metadata; a decrease can
            reflect missing metadata, rather than removed access. Missing months
            remain gaps.
          </span>
        </CardFooter>
      </Card>
    </section>
  )
}
