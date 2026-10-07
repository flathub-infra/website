"use client"

import { useState } from "react"
import { useLocale } from "next-intl"
import { defineChart, lineY } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { crosshair } from "@tanstack/charts/crosshair"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TanstackChart } from "src/components/charts/chart"
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
  const chartData = points.map((point) => ({
    ...point,
    value: point[metric],
  }))
  const definition = defineChart({
    marks: [
      lineY(chartData, {
        x: "month",
        y: "value",
        stroke: "oklch(var(--primary))",
        strokeWidth: 2,
        points: true,
      }),
      crosshair({ x: { label: true }, y: false }),
    ],
    scales: {
      x: {
        scale: () => scaleBand<string>().padding(0.2),
        axis: { ticks: { format: monthLabel } },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: {
          ticks: {
            format: (value) =>
              number.format(value) + (metric === "percentage" ? "%" : ""),
          },
        },
      },
    },
    focus: "nearest-x",
    maxFocusDistance: Number.POSITIVE_INFINITY,
    tooltip: {
      use: tooltip,
      content: (points) => ({
        title: `${points[0]?.datum.snapshotDate ?? "No snapshot"}${points[0]?.datum.month === window.end_month ? " · Latest available observation" : ""}`,
        rows: points.map((point) => ({
          label:
            metric === "percentage" ? "Share of eligible apps" : "App count",
          value:
            point.yValue == null
              ? "Unavailable"
              : number.format(Number(point.yValue)) +
                (metric === "percentage" ? "%" : ""),
          color: point.color,
        })),
      }),
    },
  })
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
              <TanstackChart
                definition={definition}
                className="h-[clamp(15rem,34vw,18rem)] w-full"
                ariaLabel={`Monthly ${metric === "count" ? "app count" : "recorded permission share"} for ${entry.value}`}
              />
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
