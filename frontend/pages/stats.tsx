import Main from '../src/components/layout/Main'
import { NextSeo } from 'next-seo'
import WorldMap from 'react-svg-worldmap'
import { useTheme } from 'next-themes'
import { GetStaticProps } from 'next'
import { fetchStats } from '../src/fetchers'
import { Stats } from '../src/types/Stats'
import styles from './stats.module.scss'
import { Line } from 'react-chartjs-2'
import { chartOptions, chartStyle } from '../src/chartHelper'
import 'chartjs-adapter-date-fns'

const Stats = ({ stats }: { stats: Stats }): JSX.Element => {
  let country_data: { country: string; value: number }[] = []
  if (stats.countries) {
    for (const [key, value] of Object.entries(stats.countries)) {
      country_data.push({ country: key, value: value })
    }
  }

  const { resolvedTheme } = useTheme()

  const borderColor = resolvedTheme === 'dark' ? '#FFFFFF' : '#000000'
  const backgroundColor = resolvedTheme === 'dark' ? '#202020' : 'white'

  let downloads_labels: string[] = []
  let downloads_data: number[] = []
  if (stats.downloads) {
    for (const [key, value] of Object.entries(stats.downloads)) {
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
      <NextSeo title='Stats' description='Flathub Stats' />
      <div className='main-container'>
        <h1>Flathub Stats</h1>
        <p></p>
        <h3>Downloads per country</h3>
        <div className={styles.map}>
          <WorldMap
            color='#52006a'
            backgroundColor={backgroundColor}
            borderColor={borderColor}
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
  }
}

export default Stats
