import { defineChart } from "@tanstack/charts"
import { treemap } from "@tanstack/charts/hierarchy/treemap"
import { tooltip } from "@tanstack/charts/tooltip"
import { rectangleFocusStates } from "./rectangle-focus"

export function createCategoryDistributionChart(
  data: { name: string; value: number }[],
  locale: string,
  colors: readonly string[],
) {
  return defineChart({
    focusRing: false,
    marks: [
      treemap(data, {
        path: (row) => encodeURIComponent(row.name),
        value: "value",
        // Squarify can exceed the bounds by floating-point residue, which
        // TanStack Charts 1.0.0 rejects during responsive layout.
        method: "binary",
        fill: (node) => {
          const index = data.findIndex(
            (entry) => entry.name === node.data?.name,
          )
          return colors[index % colors.length]
        },
        label: (node) => node.data?.name ?? node.name,
        paddingInner: 2,
        states: rectangleFocusStates,
      }),
    ],
    scales: { x: null, y: null },
    tooltip: {
      use: tooltip,
      anchor: "pointer",
      offset: 12,
      content: (points) => ({
        rows: points.map((point) => ({
          label: point.datum.data?.name ?? point.datum.name,
          value: point.datum.value.toLocaleString(locale),
          color: point.color,
        })),
      }),
    },
  })
}
