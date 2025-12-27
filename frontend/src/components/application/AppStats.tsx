import { FunctionComponent } from "react"

import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { LineChart, Line, XAxis, YAxis } from "recharts"
import { format } from "date-fns"
import { axisStroke, primaryStroke, RotatedAxisTick } from "src/chartComponents"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { StatsResultApp } from "src/codegen"

interface Props {
  stats: Pick<StatsResultApp, "installs_per_day">
}

const AppStatistics: FunctionComponent<Props> = ({ stats }) => {
  const t = useTranslations()

  const { resolvedTheme } = useTheme()

  const data = []

  if (stats.installs_per_day) {
    for (const [key, value] of Object.entries(stats.installs_per_day)) {
      data.push({ date: key, installs: value })
    }
  }

  data.sort((a, b) => a.date.localeCompare(b.date))
  data.pop()

  const chartConfig = {} satisfies ChartConfig

  return (
    <div className="p-4">
      <h3 className="my-4 mt-0 text-xl font-semibold">
        {t("installs-over-time")}
      </h3>
      <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
        <LineChart accessibilityLayer data={data}>
          <Line
            dataKey="installs"
            stroke={primaryStroke(resolvedTheme)}
            name={t("installs")}
            dot={false}
            strokeWidth={3}
          />
          <XAxis
            dataKey="date"
            name={t("date")}
            tickFormatter={(date) => {
              return format(date, "MMM d")
            }}
            stroke={axisStroke(resolvedTheme)}
            tick={<RotatedAxisTick />}
            height={60}
          />
          <YAxis stroke={axisStroke(resolvedTheme)} />
          <ChartTooltip
            content={<ChartTooltipContent />}
            labelFormatter={(t) => format(t, "P")}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

export default AppStatistics
