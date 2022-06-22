import "chart.js/auto"
import { useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { FunctionComponent, useMemo } from "react"
import { Doughnut } from "react-chartjs-2"
import { Appstream } from "../../../types/Appstream"
import { VendingConfig } from "../../../types/Vending"
import { doughnutData } from "../../../utils/charts"
import { computeAppShares, computeShares } from "../../../utils/vending"

interface Props {
  price: number
  app: Appstream
  appShare: number
  vendingConfig: VendingConfig
}

/**
 * An element to visualise the breakdown of price based on the set app share for vending.
 */
const VendingSharesPreview: FunctionComponent<Props> = ({
  price,
  app,
  appShare,
  vendingConfig,
}) => {
  const { t } = useTranslation()
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
    labels.push(appId)
    rawData.push(split / 100)
  }

  const data = doughnutData(labels, rawData, resolvedTheme as "light" | "dark")

  return (
    <div>
      <Doughnut
        data={data}
        className="inline"
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        }}
      />
    </div>
  )
}

export default VendingSharesPreview
