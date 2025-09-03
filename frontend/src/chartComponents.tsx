import { useTheme } from "next-themes"
import { getIntlLocale } from "./localize"
import { useLocale } from "next-intl"

export function axisStroke(resolvedTheme: string): string {
  return resolvedTheme === "light"
    ? "oklch(0% 0 0 / 80%)"
    : "oklch(100% 0 0 / 80%)"
}

export function primaryStroke(resolvedTheme: string): string {
  return resolvedTheme === "light"
    ? "oklch(51.85% 0.1318 252.64)"
    : "oklch(64.15% 0.1308 251.37)"
}

export const RotatedAxisTick = (props) => {
  const { resolvedTheme } = useTheme()
  const { x, y, payload, tickFormatter } = props

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        fill={
          resolvedTheme === "light"
            ? "oklch(0% 0 0 / 80%)"
            : "oklch(100% 0 0 / 80%)"
        }
        transform="rotate(-35)"
      >
        {tickFormatter ? tickFormatter(payload.value) : payload.value}
      </text>
    </g>
  )
}

export const FlathubTooltip = (props) => {
  const locale = useLocale()

  const i18n = getIntlLocale(locale)

  const { active, payload, label, labelFormatter, formatter } = props

  if (active && payload && payload.length) {
    const formattedValue = formatter
      ? formatter(
          payload[0].value.toLocaleString(i18n.language),
          payload[0].name,
          payload[0],
        )
      : payload[0].value.toLocaleString(i18n.language)

    return (
      <div className="bg-flathub-lotion dark:bg-flathub-dark-gunmetal p-4 rounded-lg">
        <div className="font-bold">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
        <div>
          {payload[0].name === "value"
            ? formattedValue
            : `${payload[0].name}: ${formattedValue}`}
        </div>
      </div>
    )
  }

  return null
}
