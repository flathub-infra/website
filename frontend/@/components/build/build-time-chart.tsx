"use client"

import { PipelineSummary } from "src/codegen-pipeline"
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

interface BuildTimeChartProps {
  builds: PipelineSummary[]
}

interface ChartData {
  date: string
  duration: number
  buildId: string
  status: string
}

export function BuildTimeChart({ builds }: BuildTimeChartProps) {
  const chartData = useMemo(() => {
    // Filter and transform builds with duration - only successful builds
    const buildsWithDuration = builds
      .filter(
        (build) =>
          build.started_at &&
          build.finished_at &&
          (build.status === "published" || build.status === "succeeded"),
      )
      .sort(
        (a, b) =>
          new UTCDate(a.created_at).getTime() -
          new UTCDate(b.created_at).getTime(),
      )
      .slice(-30)
      .map((build) => {
        const start = new UTCDate(build.started_at!)
        const end = new UTCDate(build.finished_at!)
        const durationMs = end.getTime() - start.getTime()
        const durationMinutes = Math.round(durationMs / 1000 / 60)

        return {
          date: new UTCDate(build.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          duration: durationMinutes,
          buildId: build.build_id?.toString() || "N/A",
          status: build.status,
        } as ChartData
      })

    return buildsWithDuration
  }, [builds])

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No build duration data available
      </div>
    )
  }

  const avgDuration =
    chartData.reduce((sum, item) => sum + item.duration, 0) / chartData.length
  const maxDuration = Math.max(...chartData.map((item) => item.duration))
  const minDuration = Math.min(...chartData.map((item) => item.duration))

  const formatMinutes = (minutes: number) => {
    return formatDuration({ minutes: Math.round(minutes) })
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted p-3 rounded">
          <p className="text-xs text-muted-foreground">Average Duration</p>
          <p className="text-lg font-semibold">{formatMinutes(avgDuration)}</p>
        </div>
        <div className="bg-muted p-3 rounded">
          <p className="text-xs text-muted-foreground">Max Duration</p>
          <p className="text-lg font-semibold">{formatMinutes(maxDuration)}</p>
        </div>
        <div className="bg-muted p-3 rounded">
          <p className="text-xs text-muted-foreground">Min Duration</p>
          <p className="text-lg font-semibold">{formatMinutes(minDuration)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
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
              dataKey="duration"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
              name="Duration"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
