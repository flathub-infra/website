import { FunctionComponent } from "react"
import "chart.js/auto"
import { Line } from "react-chartjs-2"
import { chartOptions, chartStyle } from "../../chartHelper"
import { AppStats } from "../../types/AppStats"
import "chartjs-adapter-date-fns"

import { i18n, useTranslation } from "next-i18next"
import { useTheme } from "next-themes"

interface Props {
  stats: AppStats
}

const AppStatistics: FunctionComponent<Props> = ({ stats }) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  let installs_labels: Date[] = []
  let installs_data: number[] = []
  if (stats.installs_per_day) {
    for (const [key, value] of Object.entries(stats.installs_per_day)) {
      installs_labels.push(new Date(key))
      installs_data.push(value)
    }
  }

  // only show graph, if we have more then ten days of data
  if (Object.keys(stats.installs_per_day).length < 10) {
    return null
  }

  // Remove current day
  installs_labels.pop()
  installs_data.pop()

  const data = chartStyle(
    installs_labels,
    installs_data,
    t("installs"),
    resolvedTheme as "light" | "dark",
  )
  const options = chartOptions(i18n.language)

  return (
    <div className="h-[300px] rounded-xl bg-bgColorSecondary px-4 pt-4 pb-12 shadow-md">
      <h3 className="mt-0">{t("installs-over-time")}</h3>
      <Line data={data} options={options} />
    </div>
  )
}

export default AppStatistics
