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
import { UTCDate } from "@date-fns/utc"
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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Successful builds: {count} of the last {sampleLimit} builds
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="bg-muted p-3 rounded">
          <p className="text-xs text-muted-foreground">Average Duration</p>
          <p className="text-lg font-semibold">
            {formatMinutes(averageMinutes)}
          </p>
        </div>
        <div className="bg-muted p-3 rounded">
          <p className="text-xs text-muted-foreground">Max Duration</p>
          <p className="text-lg font-semibold">{formatMinutes(maxMinutes)}</p>
        </div>
        <div className="bg-muted p-3 rounded">
          <p className="text-xs text-muted-foreground">Min Duration</p>
          <p className="text-lg font-semibold">{formatMinutes(minMinutes)}</p>
        </div>
      </div>
      <div className="w-full">
        <TanstackChart
          definition={definition}
          ariaLabel={t("build-duration-over-time")}
          ariaDescription={t("chart-description", {
            chart: t("build-duration-over-time"),
          })}
          className="h-[clamp(16rem,35vw,20rem)] w-full"
        />
        <ChartLegendItems
          items={[{ label: "Successful build duration", color: lineColor }]}
        />
      </div>
    </div>
  )
}
