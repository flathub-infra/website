import Main from '../src/components/layout/Main'
import { NextSeo } from 'next-seo'
import WorldMap from 'react-svg-worldmap'
import { GetStaticProps } from 'next'
import { fetchStats } from '../src/fetchers'
import { Stats as Statistics } from '../src/types/Stats'
import styles from './statistics.module.scss'
import 'chart.js/auto'
import { Line } from 'react-chartjs-2'
import { chartOptions, chartStyle } from '../src/chartHelper'
import 'chartjs-adapter-date-fns'
import {
  MdCloudDownload,
  MdCalendarToday,
  MdFormatListNumbered,
} from 'react-icons/md'
import ListBox from '../src/components/application/ListBox'

const Statistics = ({ stats }: { stats: Statistics }): JSX.Element => {
  let country_data: { country: string; value: number }[] = []
  if (stats.countries) {
    for (const [key, value] of Object.entries(stats.countries)) {
      country_data.push({ country: key, value: value })
    }
  }

  let downloads_labels: string[] = []
  let downloads_data: number[] = []
  if (stats.downloads_per_day) {
    for (const [key, value] of Object.entries(stats.downloads_per_day)) {
      downloads_labels.push(key)
      downloads_data.push(value)
    }
  }

  // Remove current day
  downloads_labels.pop()
  downloads_data.pop()

  const data = chartStyle(downloads_labels, downloads_data, 'Downloads')

  const options = chartOptions()

  return (
    <Main>
      <NextSeo title='Statistics' description='Flathub Statistics' />
      <div className='main-container'>
        <h1>Statistics</h1>
        <div className={styles.stats}>
          <ListBox
            items={[
              {
                icon: <MdCloudDownload />,
                header: 'Total downloads',
                content: {
                  type: 'text',
                  text: stats.downloads?.toLocaleString(),
                },
              },
            ]}
          />
          <ListBox
            items={[
              {
                icon: <MdFormatListNumbered />,
                header: 'Total applications',
                content: {
                  type: 'text',
                  text: stats.number_of_apps?.toLocaleString(),
                },
              },
            ]}
          />
          <ListBox
            items={[
              {
                icon: <MdCalendarToday />,
                header: 'Since',
                content: {
                  type: 'text',
                  text: new Date(2018, 3, 29).toDateString(),
                },
              },
            ]}
          />
        </div>
        <div className={styles.downloadStats}>{ }</div>
        <h3>Downloads per country</h3>
        <div className={styles.map}>
          <WorldMap
            color='var(--color-primary)'
            backgroundColor='var(--bg-color-secondary)'
            borderColor='var(--text-primary)'
            valueSuffix='downloads'
            size='responsive'
            data={country_data}
          />
        </div>
        <h3>Downloads over time</h3>
        <div className={styles.downloadsOverTime}>
          <Line data={data} options={options} />
        </div>
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  console.log('Fetching data for stats')
  const stats = await fetchStats()

  return {
    props: {
      stats,
    },
    revalidate: 3600,
  }
}

export default Statistics
