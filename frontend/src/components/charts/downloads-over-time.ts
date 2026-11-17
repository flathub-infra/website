import { defineChart, lineY } from "@tanstack/charts"
import { crosshair } from "@tanstack/charts/crosshair"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { primaryStroke } from "../../chartComponents"
import { getIntlLocale } from "../../localize"

export type MonthlyDownloadPoint = {
  date: string
  downloads: number
}

/**
 * Aggregates daily download counts into monthly totals.
 *
 * Daily statistics contain thousands of data points dating back to 2018.
 * Aggregating by month provides a readable, high-level trend over time.
 * The latest day is discarded prior to aggregation as it represents an
 * incomplete current day.
 */
export function aggregateDownloadsByMonth(
  downloadsPerDay: Record<string, number> | null | undefined,
): MonthlyDownloadPoint[] {
  const points = Object.entries(downloadsPerDay ?? {})
    .map(([date, downloads]) => ({ date, downloads }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Remove current day, which is incomplete.
  points.pop()

  const monthlyTotals = new Map<string, number>()
  for (const { date, downloads } of points) {
    const month = date.slice(0, 7)
    monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + downloads)
  }

  return Array.from(monthlyTotals.entries()).map(([date, downloads]) => ({
    date,
    downloads,
  }))
}

export function formatMonthTick(month: string, locale: string): string {
  const intlLocale = getIntlLocale(locale)
  return new Intl.DateTimeFormat(intlLocale, {
    calendar: "gregory",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`))
}

export function formatMonthTooltip(month: string, locale: string): string {
  const intlLocale = getIntlLocale(locale)
  return new Intl.DateTimeFormat(intlLocale, {
    calendar: "gregory",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`))
}

export function createDownloadsOverTimeChart(
  data: MonthlyDownloadPoint[],
  locale: string,
) {
  const intlLocale = getIntlLocale(locale)
  const monthFormat = new Intl.DateTimeFormat(intlLocale, {
    calendar: "gregory",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
  const monthTooltipFormat = new Intl.DateTimeFormat(intlLocale, {
    calendar: "gregory",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  const dateValue = (date: string, formatter: Intl.DateTimeFormat) =>
    formatter.format(new Date(`${date}-01T00:00:00Z`))

  return defineChart({
    marks: [
      lineY(data, {
        x: "date",
        y: "downloads",
        stroke: primaryStroke,
        strokeWidth: 3,
      }),
      crosshair({ x: { label: true }, y: false }),
    ],
    scales: {
      x: {
        scale: () => scaleBand<string>().padding(0.2),
        axis: {
          ticks: {
            size: 0,
            spacing: 104,
            format: (date) => dateValue(date, monthFormat),
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: {
          ticks: {
            format: (value) => value.toLocaleString(locale),
          },
        },
      },
    },
    focus: "nearest-x",
    maxFocusDistance: Number.POSITIVE_INFINITY,
    tooltip: {
      use: tooltip,
      format: (point) =>
        `${dateValue(point.datum.date, monthTooltipFormat)}: ${Number(point.yValue).toLocaleString(locale)}`,
    },
  })
}
