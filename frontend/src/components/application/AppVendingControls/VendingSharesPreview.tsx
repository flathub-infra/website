import "chart.js/auto"
import { useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { FunctionComponent, useMemo } from "react"
import { Bar } from "react-chartjs-2"
import { Appstream } from "../../../types/Appstream"
import { VendingConfig } from "../../../types/Vending"
import { stackedBarData } from "../../../utils/charts"
import { computeAppShares, computeShares } from "../../../utils/vending"

interface Props {
  price: number
  appId: string
  app?: Appstream
  appShare: number
  vendingConfig: VendingConfig
}

/**
 * An element to visualise the breakdown of price based on the set app share for vending.
 *
 * TODO: Use robust currency formatting once multiple currencies are supported
 */
const VendingSharesPreview: FunctionComponent<Props> = ({
  price,
  appId,
  app,
  appShare,
  vendingConfig,
}) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()

  // Don't re-run computations unnecessarily
  const shares = useMemo(
    () => computeShares(appId, app?.bundle.runtime, appShare, vendingConfig),
    [appId, app, appShare, vendingConfig],
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
  for (const [breakdownAppId, split] of breakdown) {
    labels.push(breakdownAppId == appId ? app?.name ?? appId : breakdownAppId)
    rawData.push(split / 100)
  }

  const data = stackedBarData(
    labels,
    rawData,
    resolvedTheme as "light" | "dark",
  )

  // Corresponds to text secondary for dark and light theme
  const textColor =
    resolvedTheme === "light" ? "hsl(0, 0%, 44.7%)" : "rgba(255, 255, 255, 0.6)"

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
              },
            },
          },
        }}
      />
    </div>
  )
}

export default VendingSharesPreview
