import { ChartData, ChartDataset } from "chart.js"

export function doughnutData(
  labels: (string | Date)[],
  data: number[],
  mode: "dark" | "light",
): ChartData<"doughnut", number[]> {
  const lightness = mode === "light" ? "55.1%" : "calc(55.1% - 15%)"

  const colors = []
  for (let index = 0; index < data.length; index++) {
    colors.push(`hsl(${212.9 - index * 35}, 58.1%, ${lightness})`)
  }

  return {
    labels: labels,
    datasets: [
      {
        backgroundColor: colors,
        borderColor: "white",
        borderJoinStyle: "miter",
        data: data,
      },
    ],
  }
}

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
      backgroundColor: `hsl(${212.9 - i * 35}, 58.1%, ${lightness})`,
    } as ChartDataset<"bar", number[]>
  })

  return {
    labels,
    datasets,
  }
}
