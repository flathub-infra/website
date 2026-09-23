"use client"

import type { PipelineSummary } from "src/codegen-pipeline"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import { useMemo } from "react"
import { formatDuration } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { useLocale } from "next-intl"
import { useTheme } from "next-themes"
import { getIntlLocale } from "src/localize"
import { primaryStroke, axisStroke } from "src/chartComponents"
import { summarizeSeries, toDurationSeries } from "src/builds/pipeline-history"

interface BuildTimeChartProps {
  builds: PipelineSummary[]
  sampleLimit: number
}

export function BuildTimeChart({ builds, sampleLimit }: BuildTimeChartProps) {
  const locale = useLocale()
  const { resolvedTheme } = useTheme()
  const lineColor = primaryStroke(resolvedTheme ?? "light")
  const axisColor = axisStroke(resolvedTheme ?? "light")
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
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} />
            <XAxis dataKey="date" stroke={axisColor} />
            <YAxis
              stroke={axisColor}
              label={{
                value: "Duration (minutes)",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value) =>
                formatDuration({ minutes: value as number })
              }
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="durationMinutes"
              stroke={lineColor}
              strokeWidth={2}
              dot={count <= 30 ? { fill: lineColor, r: 4 } : false}
              activeDot={{ r: 6, fill: lineColor }}
              name="Successful build duration"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
