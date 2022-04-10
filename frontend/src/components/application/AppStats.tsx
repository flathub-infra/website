import { FunctionComponent } from 'react'
import 'chart.js/auto'
import { Line } from 'react-chartjs-2'
import { chartOptions, chartStyle } from '../../chartHelper'
import { AppStats } from '../../types/AppStats'
import 'chartjs-adapter-date-fns'

import styles from './AppStats.module.scss'
import { i18n, useTranslation } from 'next-i18next'
import { useTheme } from 'next-themes'

interface Props {
  stats: AppStats
}

const AppStatistics: FunctionComponent<Props> = ({ stats }) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  let downloads_labels: Date[] = []
  let downloads_data: number[] = []
  if (stats.downloads_per_day) {
    for (const [key, value] of Object.entries(stats.downloads_per_day)) {
      downloads_labels.push(new Date(key))
      downloads_data.push(value)
    }
  }

  // Remove current day
  downloads_labels.pop()
  downloads_data.pop()

  const data = chartStyle(downloads_labels, downloads_data, t('installs'), resolvedTheme)
  const options = chartOptions(i18n.language)

  return (
    <div className={styles.downloads}>
      <h3>{t('installs-over-time')}</h3>
      <Line data={data} options={options} />
    </div>
  )
}

export default AppStatistics
