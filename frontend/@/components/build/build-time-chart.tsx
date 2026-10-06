"use client"

import type { PipelineSummary } from "src/codegen-pipeline"
import { defineChart, lineY } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { d3Curve } from "@tanstack/charts/d3/shape"
import { curveMonotoneX } from "d3-shape"
import { ChartLegendItems, TanstackChart } from "src/components/charts/chart"
import { useMemo } from "react"
import { formatDuration } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { useLocale } from "next-intl"
import { getIntlLocale } from "src/localize"
import { primaryStroke } from "src/chartComponents"
import { summarizeSeries, toDurationSeries } from "src/builds/pipeline-history"

interface BuildTimeChartProps {
  builds: PipelineSummary[]
  sampleLimit: number
}

export function BuildTimeChart({ builds, sampleLimit }: BuildTimeChartProps) {
  const locale = useLocale()
  const lineColor = primaryStroke
  const chartData = useMemo(() => {
    const dateFormatter = new Intl.DateTimeFormat(
      getIntlLocale(locale).toString(),
      {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      },
    )
    const points = toDurationSeries(builds, (startedAt) =>
      dateFormatter.format(startedAt),
    )
    if (
      points.length > 0 &&
      points[0].startedAt.slice(0, 10) ===
        points[points.length - 1].startedAt.slice(0, 10)
    ) {
      const timeFormatter = new Intl.DateTimeFormat(
        getIntlLocale(locale).toString(),
        {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        },
      )
      return toDurationSeries(builds, (startedAt) =>
        timeFormatter.format(startedAt),
      )
    }
    return points
  }, [builds, locale])

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(chartData, {
            x: "date",
            y: "durationMinutes",
            stroke: lineColor,
            strokeWidth: 2,
            points: true,
            curve: d3Curve(curveMonotoneX),
          }),
        ],
        scales: {
          x: { scale: () => scaleBand<string>().padding(0.2) },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: "Duration (minutes)" },
          },
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${point.datum.date}: ${formatDuration({ minutes: Number(point.yValue) })}`,
        },
      }),
    [chartData, lineColor],
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
      <div className="grid grid-cols-3 gap-4">
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
          ariaLabel="Build duration over time"
          height={320}
        />
        <ChartLegendItems
          items={[{ label: "Successful build duration", color: lineColor }]}
        />
      </div>
    </div>
  )
}
