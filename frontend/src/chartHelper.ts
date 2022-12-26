import { ChartData, ChartOptions } from "chart.js"
import { getIntlLocale, getLocale } from "./localize"

export function chartStyle(
  labels: (string | Date)[],
  data: number[],
  label: string,
  mode: "dark" | "light",
): ChartData<"line", number[]> {
  const color =
    mode === "light"
      ? "hsl(212.9, 58.1%, 55.1%)"
      : "hsl(212.9, 58.1%, calc(55.1% - 15%))"

  return {
    labels: labels,
    datasets: [
      {
        label: label,
        fill: false,
        borderColor: color,
        borderCapStyle: "butt",
        borderDash: [],
        borderDashOffset: 0.0,
        borderJoinStyle: "miter",
        pointBorderColor: color,
        pointBackgroundColor: color,
        pointBorderWidth: 1,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: color,
        pointHoverBorderWidth: 2,
        pointRadius: 1,
        pointHitRadius: 10,
        data: data,
      },
    ],
  }
}

export function chartOptions(
  locale: string,
  resolvedTheme: "light" | "dark",
): ChartOptions<"line"> {
  return {
    locale: getIntlLocale(locale).toString(),
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        adapters: {
          date: { locale: getLocale(locale) },
        },
        type: "time",
        time: {
          minUnit: "day",
          tooltipFormat: "P",
        },
        grid: {
          display: false,
          borderColor:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },

        ticks: {
          autoSkip: true,
          autoSkipPadding: 10,
          color:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },
      },
      y: {
        grid: {
          display: false,
          borderColor:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },
        ticks: {
          count: 5,
          precision: 0,
          color:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },
      },
    },
    plugins: {
      tooltip: {
        displayColors: false,
      },
      legend: {
        display: false,
      },
    },
  }
}

export function barChartOptions(
  locale: string,
  resolvedTheme: "light" | "dark",
): ChartOptions<"bar"> {
  return {
    locale: getIntlLocale(locale).toString(),
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false,
          borderColor:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },
        ticks: {
          color:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },
      },
      y: {
        grid: {
          display: false,
          borderColor:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },
        ticks: {
          color:
            resolvedTheme === "light"
              ? "hsl(0, 0%, 44.7%)"
              : "rgba(255, 255, 255, 0.6)",
        },
      },
    },
    plugins: {
      tooltip: {
        displayColors: false,
      },
      legend: {
        display: false,
      },
    },
  }
}
