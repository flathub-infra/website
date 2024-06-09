import { FunctionComponent } from "react"
import { AppStats } from "../../types/AppStats"

import { useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import {
  axisStroke,
  FlathubTooltip,
  primaryStroke,
  RotatedAxisTick,
} from "src/chartComponents"

interface Props {
  stats: AppStats
}

const AppStatistics: FunctionComponent<Props> = ({ stats }) => {
  const { t } = useTranslation()

  const { resolvedTheme } = useTheme()

  const data = []

  if (stats.installs_per_day) {
    for (const [key, value] of Object.entries(stats.installs_per_day)) {
      data.push({ date: key, installs: value })
    }
  }

  // Remove current day
  data.pop()

  return (
    <div className="p-4">
      <h3 className="my-4 mt-0 text-xl font-semibold">
        {t("installs-over-time")}
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
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
          <Tooltip
            content={<FlathubTooltip />}
            labelFormatter={(t) => format(t, "P")}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default AppStatistics
