import { ChartData, ChartOptions } from 'chart.js'
import { getLocale } from './localize'

export function chartStyle(
  labels: (string | Date)[],
  data: number[],
  label: string,
  mode: 'dark' | 'light',
): ChartData<'line', number[]> {
  const color = mode === 'light' ? 'hsl(212.9, 58.1%, 55.1%)' : 'hsl(212.9, 58.1%, calc(55.1% - 15%))'

  return {
    labels: labels,
    datasets: [
      {
        label: label,
        fill: false,
        borderColor: color,
        borderCapStyle: 'butt',
        borderDash: [],
        borderDashOffset: 0.0,
        borderJoinStyle: 'miter',
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

export function chartOptions(locale: string): ChartOptions<'line'> {
  return {
    locale: locale.substring(0, 2),
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        adapters: {
          date: { locale: getLocale(locale) }
        },
        type: 'time',
        time: {
          minUnit: 'day',
          tooltipFormat: "P",
        },
        title: {
          display: true,
        },
        grid: {
          display: false,
        },
        ticks: {
          autoSkip: true,
          autoSkipPadding: 10,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          count: 5,
        }
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
