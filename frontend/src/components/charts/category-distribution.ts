import { defineChart } from "@tanstack/charts"
import { treemap } from "@tanstack/charts/hierarchy/treemap"
import { tooltip } from "@tanstack/charts/tooltip"
import { rectangleFocusStates } from "./rectangle-focus"

export function createCategoryDistributionChart(
  data: { id?: string; name: string; value: number }[],
  locale: string,
  colors: readonly string[],
) {
  const colorById = new Map(
    [...data]
      .sort((left, right) =>
        (left.id ?? left.name).localeCompare(right.id ?? right.name),
      )
      .map((row, index) => [row.id ?? row.name, colors[index % colors.length]]),
  )

  return defineChart({
    focusRing: false,
    marks: [
      treemap(data, {
        path: (row) => encodeURIComponent(row.name),
        value: "value",
        // Squarify can exceed the bounds by floating-point residue, which
        // TanStack Charts 1.0.0 rejects during responsive layout.
        method: "binary",
        fill: (node) =>
          colorById.get(node.data?.id ?? node.data?.name ?? "") ?? colors[0],
        label: (node) => node.data?.name ?? node.name,
        labelPadding: 8,
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
