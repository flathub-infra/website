import "chart.js/auto"
import { useTheme } from "next-themes"
import { FunctionComponent, useMemo } from "react"
import { Bar } from "react-chartjs-2"
import { Appstream } from "../../../types/Appstream"
import { VendingConfig } from "../../../types/Vending"
import { stackedBarData } from "../../../utils/charts"
import { computeAppShares, computeShares } from "../../../utils/vending"
import { ChartType, Tooltip, TooltipPositionerFunction } from "chart.js"

interface Props {
  price: number
  app: Appstream
  appShare: number
  vendingConfig: VendingConfig
}

declare module "chart.js" {
  interface TooltipPositionerMap {
    center: TooltipPositionerFunction<ChartType>
  }
}

Tooltip.positioners.center = function (items) {
  if (items.length) {
    const { x, y } = items[0].element
    const { base } = items[0].element.getProps(["base"])
    const width = !base ? 0 : x - base
    return { x: x - width / 2, y: y, xAlign: "center", yAlign: "bottom" }
  }
  return false
}

/**
 * An element to visualise the breakdown of price based on the set app share for vending.
 *
 * TODO: Use robust currency formatting once multiple currencies are supported
 */
const VendingSharesPreview: FunctionComponent<Props> = ({
  price,
  app,
  appShare,
  vendingConfig,
}) => {
  const { resolvedTheme } = useTheme()

  // Don't re-run computations unnecessarily
  const shares = useMemo(
    () => computeShares(app, appShare, vendingConfig),
    [app, appShare, vendingConfig],
  )
  const breakdown = useMemo(
    () => (price > 0 ? computeAppShares(price, shares, vendingConfig) : []),
    [price, shares, vendingConfig],
  )

  if (price <= 0) {
    return <></>
  }

  const labels: string[] = []
  const rawData: number[] = []
  for (const [appId, split] of breakdown) {
    labels.push(appId == app.id ? app.name : appId)
    rawData.push(split / 100)
  }

  const data = stackedBarData(
    labels,
    rawData,
    resolvedTheme as "light" | "dark",
  )

  // Corresponds to text secondary for dark and light theme
  const textColor =
    resolvedTheme === "light" ? "rgb(36, 31, 49)" : "rgb(222, 221, 218)"

  return (
    <div>
      <Bar
        data={data}
        className="inline"
        options={{
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          scales: {
            y: {
              stacked: true,
              max: 0, // Stack chart shows a single bar
              display: false,
            },
            x: {
              stacked: true,
              ticks: {
                callback: (value: number) => `$${value.toFixed(2)}`,
                color: textColor,
              },
            },
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: textColor,
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => `$${context.parsed.x.toFixed(2)}`,
                title: (context) => {
                  const appId = context[0].dataset.label
                  return appId == app.id ? app.name : appId
                },
              },
              position: "center",
            },
          },
        }}
      />
    </div>
  )
}

export default VendingSharesPreview
