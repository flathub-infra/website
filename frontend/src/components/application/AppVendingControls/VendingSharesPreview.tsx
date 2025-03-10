import { useTheme } from "next-themes"
import { FunctionComponent, useMemo } from "react"
import { Appstream } from "../../../types/Appstream"
import { computeAppShares, computeShares } from "../../../utils/vending"
import { axisStroke } from "src/chartComponents"
import { formatCurrency } from "src/utils/localize"
import { useTranslation } from "next-i18next"
import { VendingConfig } from "src/codegen"
import { translatePlatformName } from "@/lib/helpers"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

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
  const { t } = useTranslation()

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
    const name = (appId == app.id ? app.name : appId).replaceAll(".", "-")
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

  const lightness = resolvedTheme === "light" ? "70%" : "calc(70% - 20%)"

  const chartConfig = Object.values(labels).reduce(
    (red, label, i) => ({
      ...red,
      [label]: {
        label: t(translatePlatformName(label)),
        color: `oklch(${lightness} 0.2 ${251.57 - i * 50})`,
      },
    }),
    {},
  ) satisfies ChartConfig

  return (
    <div>
      <ChartContainer className="h-32 w-full" config={chartConfig}>
        <BarChart accessibilityLayer layout="vertical" data={data}>
          {labels.map((label, i) => {
            return (
              <Bar
                key={label}
                dataKey={label}
                stackId="a"
                fill={`var(--color-${label})`}
              />
            )
          })}
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <>
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)"
                      style={
                        {
                          "--color-bg": `var(--color-${name})`,
                        } as React.CSSProperties
                      }
                    />
                    {chartConfig[name]?.label || name}
                    <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                      {formatCurrency(Number(value))}
                    </div>
                  </>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <XAxis
            type="number"
            tickFormatter={(x) => formatCurrency(x)}
            stroke={axisStroke(resolvedTheme)}
          />
          <YAxis type="category" dataKey="Bar" hide />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

export default VendingSharesPreview
