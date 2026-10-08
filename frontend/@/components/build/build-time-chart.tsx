"use client"

import type { PipelineSummary } from "src/codegen-pipeline"
import { defineChart, lineY } from "@tanstack/charts"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { crosshair } from "@tanstack/charts/crosshair"
import { scaleUtc } from "d3-scale"
import { ChartLegendItems, TanstackChart } from "src/components/charts/chart"
import { useMemo } from "react"
import { formatDuration } from "date-fns"
import { useLocale, useTranslations } from "next-intl"
import { getIntlLocale } from "src/localize"
import { primaryStroke } from "src/chartComponents"
import { summarizeSeries, toDurationSeries } from "src/builds/pipeline-history"

interface BuildTimeChartProps {
  builds: PipelineSummary[]
  sampleLimit: number
}

export function BuildTimeChart({ builds, sampleLimit }: BuildTimeChartProps) {
  const locale = useLocale()
  const t = useTranslations()
  const lineColor = primaryStroke
  const axisDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(getIntlLocale(locale).toString(), {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  )
  const tooltipDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(getIntlLocale(locale).toString(), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }),
    [locale],
  )
  const chartData = useMemo(() => {
    return toDurationSeries(builds, (startedAt) =>
      tooltipDateFormatter.format(startedAt),
    ).map((point) => ({
      ...point,
      startedAtDate: new Date(point.startedAt),
    }))
  }, [builds, tooltipDateFormatter])

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(chartData, {
            x: "startedAtDate",
            y: "durationMinutes",
            stroke: lineColor,
            strokeWidth: 2,
            points: true,
          }),
          crosshair({ x: { label: true }, y: false }),
        ],
        scales: {
          x: {
            scale: scaleUtc,
            nice: true,
            axis: {
              ticks: {
                spacing: 96,
                size: 0,
                format: (value) => axisDateFormatter.format(value as Date),
              },
            },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: "Duration (minutes)" },
          },
        },
        focus: "nearest-x",
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${point.datum.date}: ${formatDuration({ minutes: Number(point.yValue) })}`,
        },
      }),
    [axisDateFormatter, chartData, lineColor],
  )

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No successful builds with recorded durations yet.
      </p>
    )
  }

  const { count, averageMinutes, maxMinutes, minMinutes } =
    summarizeSeries(chartData)
  const formatMinutes = (minutes: number) =>
    formatDuration({ minutes: Math.round(minutes) })

  return (
    <div className="grid gap-5 md:grid-cols-[160px_minmax(0,1fr)]">
      <p className="text-xs text-muted-foreground md:col-span-2">
        Successful builds: {count} of the last {sampleLimit} builds
      </p>
      <dl className="grid grid-cols-3 gap-3 md:grid-cols-1 md:content-start md:gap-5">
        <div>
          <dt className="text-xs text-muted-foreground">Average</dt>
          <dd className="mt-1 font-mono text-sm font-semibold tabular-nums sm:text-lg">
            {formatMinutes(averageMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Longest</dt>
          <dd className="mt-1 font-mono text-sm font-semibold tabular-nums sm:text-lg">
            {formatMinutes(maxMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Shortest</dt>
          <dd className="mt-1 font-mono text-sm font-semibold tabular-nums sm:text-lg">
            {formatMinutes(minMinutes)}
          </dd>
        </div>
      </dl>
      <div className="min-w-0">
        <TanstackChart
          definition={definition}
          ariaLabel={t("build-duration-over-time")}
          ariaDescription={t("chart-description", {
            chart: t("build-duration-over-time"),
          })}
          className="h-56 w-full"
        />
        <ChartLegendItems
          items={[{ label: "Successful build duration", color: lineColor }]}
        />
      </div>
    </div>
  )
}
