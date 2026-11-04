"use client"

import { useState } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { defineChart, lineY } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { crosshair } from "@tanstack/charts/crosshair"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  const t = useTranslations("permission-statistics")
  const common = useTranslations()
  const format = useFormatter()
  const metricValue = (value: number) =>
    metric === "percentage"
      ? format.number(value / 100, {
          style: "percent",
          maximumFractionDigits: 1,
        })
      : number.format(value)
  const dateLabel = (value: string) =>
    format.dateTime(new Date(value + "T00:00:00Z"), {
      dateStyle: "medium",
      timeZone: "UTC",
    })
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
        scale: scaleLinear().domain([
          0,
          metric === "percentage"
            ? 100
            : Math.max(1, ...points.map((point) => point.count ?? 0)),
        ]),
        nice: true,
        grid: true,
        axis: {
          ticks: {
            format: (value) => metricValue(value),
          },
        },
      },
    },
    focus: "nearest-x",
    maxFocusDistance: Number.POSITIVE_INFINITY,
    tooltip: {
      use: tooltip,
      content: (points) => ({
        title: points[0]?.datum.snapshotDate
          ? dateLabel(points[0].datum.snapshotDate)
          : t("no-snapshot"),
        rows: points.map((point) => ({
          label: metric === "percentage" ? t("eligible-share") : t("app-count"),
          value:
            point.yValue == null
              ? t("unavailable")
              : metricValue(Number(point.yValue)),
          color: point.color,
        })),
      }),
    },
  })
  return (
    <section
      id={id}
      aria-label={t("trend")}
      className="min-w-0 border-t border-border bg-muted/30 px-4 py-5 sm:px-6"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t("trend")}</h3>
          <PermissionStatsSelect
            label={t("measure")}
            hideLabel
            value={metric}
            onValueChange={(value) => setMetric(value as typeof metric)}
            options={[
              { value: "count", label: t("app-count") },
              { value: "percentage", label: t("eligible-share") },
            ]}
            disabled={!entry || window.snapshots.length < 2}
          />
        </div>
        {window.snapshots.length < 2 ? (
          <Alert role="status">
            <AlertTitle>{t("no-history")}</AlertTitle>
            <AlertDescription>{t("no-history-description")}</AlertDescription>
          </Alert>
        ) : entry ? (
          <div className="flex flex-col gap-4">
            <TanstackChart
              definition={definition}
              className="h-[clamp(15rem,34vw,18rem)] w-full"
              ariaLabel={t(metric === "count" ? "chart-count" : "chart-share", {
                permission: entry.value,
              })}
            />
          </div>
        ) : null}
        {entry ? (
          <details className="mt-5 border-t border-border pt-4 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              {t("snapshot-details")}
            </summary>
            <Table
              className="mt-2"
              aria-label={t("snapshot-details")}
              tabIndex={0}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>{t("month")}</TableHead>
                  <TableHead>{t("observed")}</TableHead>
                  <TableHead className="text-end">{common("apps")}</TableHead>
                  <TableHead className="text-end">{t("coverage")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point) => (
                  <TableRow key={point.month}>
                    <TableCell>{monthLabel(point.month)}</TableCell>
                    <TableCell>
                      {point.snapshotDate
                        ? dateLabel(point.snapshotDate)
                        : t("no-snapshot")}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {point.count === null ? "—" : number.format(point.count)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {point.metadataCoverage === null
                        ? "—"
                        : format.number(point.metadataCoverage / 100, {
                            style: "percent",
                            maximumFractionDigits: 1,
                          })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        ) : null}
      </div>
    </section>
  )
}
