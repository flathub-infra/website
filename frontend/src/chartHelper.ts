import { ChartData, ChartOptions } from 'chart.js'

export function chartStyle(
  labels: (string | Date)[],
  data: number[],
  label: string
): ChartData<'line', number[]> {
  const color = '#52006a'

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

export function chartOptions(gridColor: string): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        title: {
          display: true,
        },
        grid: {
          color: gridColor,
        },
      },
      y: {
        grid: {
          color: gridColor,
        },
      },
    },
    plugins: {
      tooltip: {
        displayColors: false,
        callbacks: {
          title: function (tooltipItems) {
            return tooltipItems[0].label.replace(/, \d+:\d+:\d+ a.m./, '')
          },
        },
      },
    },
  }
}
