import { useTheme } from "next-themes"

export function axisStroke(resolvedTheme: string): string {
  return resolvedTheme === "light"
    ? "rgba(0, 0, 0, 0.8)"
    : "rgba(255, 255, 255, 0.8)"
}

export function primaryStroke(resolvedTheme: string): string {
  return resolvedTheme === "light"
    ? "hsl(210.6, 65.3%, 57.1%)"
    : "hsl(210.6, 65.3%, calc(57.1% - 15%))"
}

export const RotatedAxisTick = (props) => {
  const { resolvedTheme } = useTheme()
  const { x, y, payload, stroke, tickFormatter } = props

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        fill={
          resolvedTheme === "light"
            ? "rgba(0, 0, 0, 0.8)"
            : "rgba(255, 255, 255, 0.8)"
        }
        transform="rotate(-35)"
      >
        {tickFormatter ? tickFormatter(payload.value) : payload.value}
      </text>
    </g>
  )
}

export const FlathubTooltip = (props) => {
  const { active, payload, label, labelFormatter } = props

  if (active && payload && payload.length) {
    return (
      <div className="bg-flathub-lotion dark:bg-flathub-dark-gunmetal p-4 rounded-lg">
        <div className="font-bold">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
        <div className="label">
          {payload[0].name === "value"
            ? payload[0].value
            : `${payload[0].name}: ${payload[0].value}`}
        </div>
      </div>
    )
  }

  return null
}
