import { defineChart, lineY } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { primaryStroke } from "../../chartComponents"

type InstallPoint = { date: string; installs: number }

export function formatInstallDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    calendar: "gregory",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

export function createAppStatsChart(data: InstallPoint[], locale: string) {
  const numberFormat = new Intl.NumberFormat(locale)

  return defineChart({
    marks: [
      lineY(data, {
        x: "date",
        y: "installs",
        stroke: primaryStroke,
        strokeWidth: 3,
      }),
    ],
    scales: {
      x: {
        scale: () => scaleBand<string>().padding(0.2),
        axis: {
          ticks: {
            size: 0,
            spacing: 72,
            format: (date) => formatInstallDate(date, locale),
          },
          // Horizontal labels and automatic thinning avoid rotated labels
          // overlapping the plot, including in RTL locales.
          tickLabels: { thin: { minGap: 8, priority: "ends" } },
        },
      },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    tooltip: {
      use: tooltip,
      format: (point) =>
        `${formatInstallDate(point.datum.date, locale)}: ${numberFormat.format(Number(point.yValue))}`,
    },
  })
}
