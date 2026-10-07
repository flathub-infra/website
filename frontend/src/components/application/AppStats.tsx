import { FunctionComponent } from "react"

import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { createAppStatsChart } from "./app-stats-chart"
import { TanstackChart } from "src/components/charts/chart"
import { StatsResultApp } from "src/codegen"

interface Props {
  stats: Pick<StatsResultApp, "installs_per_day">
}

const AppStatistics: FunctionComponent<Props> = ({ stats }) => {
  const t = useTranslations()
  const locale = useLocale()

  const data = useMemo(() => {
    const points = Object.entries(stats.installs_per_day ?? {}).map(
      ([date, installs]) => ({ date, installs }),
    )
    points.sort((a, b) => a.date.localeCompare(b.date))
    points.pop()
    return points
  }, [stats.installs_per_day])

  const definition = useMemo(
    () => createAppStatsChart(data, locale),
    [data, locale],
  )

  return (
    <div className="p-4">
      <h3 className="my-4 mt-0 text-xl font-semibold">
        {t("installs-over-time")}
      </h3>
      <TanstackChart
        definition={definition}
        ariaLabel={t("installs-over-time")}
        ariaDescription={t("chart-description", {
          chart: t("installs-over-time"),
        })}
        className="h-[clamp(18rem,42vw,26rem)] w-full"
      />
    </div>
  )
}

export default AppStatistics
