"use client"

import { Chart } from "@tanstack/charts/react/tooltip"
import type { ChartDefinition } from "@tanstack/charts/react"
import type { ComponentProps } from "react"

type TanstackChartProps = Omit<
  ComponentProps<typeof Chart>,
  "definition" | "ariaLabel"
> & {
  definition: ChartDefinition
  ariaLabel: string
}

export function TanstackChart({ className, ...props }: TanstackChartProps) {
  return <Chart {...props} className={`tanstack-chart ${className ?? ""}`} />
}

export function ChartLegendItems({
  items,
}: {
  items: readonly { label: string; color: string }[]
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4 text-xs">
      {items.map(({ label, color }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: color }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}
