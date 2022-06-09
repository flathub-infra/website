import { ChartData } from "chart.js"

export function doughnutData(
  labels: (string | Date)[],
  data: number[],
  label: string,
  mode: "dark" | "light",
): ChartData<"doughnut", number[]> {
  const color =
    mode === "light"
      ? "hsl(212.9, 58.1%, 55.1%)"
      : "hsl(212.9, 58.1%, calc(55.1% - 15%))"

  return {
    labels: labels,
    datasets: [
      {
        label: label,
        backgroundColor: color,
        borderColor: "white",
        borderJoinStyle: "miter",
        data: data,
      },
    ],
  }
}
