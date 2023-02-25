import { ChartData, ChartDataset } from "chart.js"

/**
 * Constructs the chart data for a single stacked bar.
 * @param labels list of bar segment labels
 * @param data list of bar segment values
 * @param mode theme to color chart
 * @returns bar chart data object
 */
export function stackedBarData(
  labels: (string | Date)[],
  data: number[],
  mode: "dark" | "light",
): ChartData<"bar", number[]> {
  const lightness = mode === "light" ? "55.1%" : "calc(55.1% - 15%)"

  const datasets = data.map((value, i) => {
    return {
      label: labels[i],
      data: [value],
      backgroundColor: `hsl(${210.6 - i * 35}, 65.3%, ${lightness})`,
    } as ChartDataset<"bar", number[]>
  })

  return {
    labels,
    datasets,
  }
}
