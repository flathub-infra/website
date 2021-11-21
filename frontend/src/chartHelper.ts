import { ChartData, ChartOptions, ScatterDataPoint } from 'chart.js'

export function chartStyle(
  labels: (string | Date)[],
  data: number[],
  label: string
): ChartData<'line', number[]> {
  return {
    labels: labels,
    datasets: [
      {
        label: label,
        fill: false,
        borderColor: '#52006a',
        borderCapStyle: 'butt',
        borderDash: [],
        borderDashOffset: 0.0,
        borderJoinStyle: 'miter',
        pointBorderColor: '#52006a',
        pointBackgroundColor: '52006a',
        pointBorderWidth: 1,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#52006a',
        pointHoverBorderColor: '#52006a',
        pointHoverBorderWidth: 2,
        pointRadius: 1,
        pointHitRadius: 10,
        data: data,
      },
    ],
  }
}

export function chartOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        title: {
          display: true,
        },
      },
    },
  }
}
