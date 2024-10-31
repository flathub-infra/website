import { useTheme } from "next-themes"
import { FunctionComponent, useMemo } from "react"
import { Appstream } from "../../../types/Appstream"
import { VendingConfig } from "../../../types/Vending"
import { computeAppShares, computeShares } from "../../../utils/vending"
import {
  BarChart,
  ResponsiveContainer,
  Bar as RechartsBar,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  XAxis,
  YAxis,
} from "recharts"
import { FlathubTooltip, axisStroke } from "src/chartComponents"
import { formatCurrency } from "src/utils/localize"
import { useTranslation } from "next-i18next"

interface Props {
  price: number
  app: Pick<Appstream, "id" | "name" | "bundle">
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
  app,
  appShare,
  vendingConfig,
}) => {
  const { resolvedTheme } = useTheme()
  const { i18n } = useTranslation()

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

  const data = []

  for (const [appId, split] of breakdown) {
    const name = appId == app.id ? app.name : appId
    labels.push(name)

    const splitObject = {}
    splitObject[name] = split / 100

    if (data.length == 0) {
      data.push({
        name: "Bar",
        ...splitObject,
      })
      continue
    }

    data[0][name] = split / 100
  }

  const lightness = resolvedTheme === "light" ? "55.1%" : "calc(55.1% - 15%)"

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart accessibilityLayer layout="vertical" data={data}>
          {labels.map((label, i) => (
            <RechartsBar
              key={label}
              dataKey={label}
              stackId="a"
              fill={`hsl(${210.6 - i * 35}, 65.3%, ${lightness})`}
            />
          ))}
          <RechartsTooltip
            shared={false}
            content={<FlathubTooltip />}
            formatter={(value) =>
              `${formatCurrency(Number(value), i18n.language)}`
            }
          />
          <RechartsLegend />
          <XAxis
            type="number"
            tickFormatter={(x) => formatCurrency(x)}
            stroke={axisStroke(resolvedTheme)}
          />
          <YAxis type="category" dataKey="Bar" hide />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default VendingSharesPreview
