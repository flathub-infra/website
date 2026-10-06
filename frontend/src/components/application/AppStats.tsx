import { FunctionComponent } from "react"

import { useTranslations } from "next-intl"
import { defineChart, lineY } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { useMemo } from "react"
import { format } from "date-fns"
import { primaryStroke } from "src/chartComponents"
import { TanstackChart } from "src/components/charts/chart"
import { StatsResultApp } from "src/codegen"

interface Props {
  stats: Pick<StatsResultApp, "installs_per_day">
}

const AppStatistics: FunctionComponent<Props> = ({ stats }) => {
  const t = useTranslations()

  const data = []

  if (stats.installs_per_day) {
    for (const [key, value] of Object.entries(stats.installs_per_day)) {
      data.push({ date: key, installs: value })
    }
  }

  data.sort((a, b) => a.date.localeCompare(b.date))
  data.pop()

  const stroke = primaryStroke
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(data, {
            x: "date",
            y: "installs",
            stroke,
            strokeWidth: 3,
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand<string>().padding(0.2),
            axis: {
              ticks: { size: 0, format: (date) => format(date, "MMM d") },
              tickLabels: { rotate: -35, anchor: "end" },
            },
          },
          y: { scale: scaleLinear, nice: true, grid: true },
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${format(point.datum.date, "P")}: ${Number(point.yValue).toLocaleString()}`,
        },
      }),
    [data, stroke],
  )

  return (
    <div className="p-4">
      <h3 className="my-4 mt-0 text-xl font-semibold">
        {t("installs-over-time")}
      </h3>
      <TanstackChart
        definition={definition}
        ariaLabel={t("installs-over-time")}
        height={400}
        className="min-h-[400px] w-full"
      />
    </div>
  )
}

export default AppStatistics
