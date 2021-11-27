import { FunctionComponent, useEffect } from 'react'

import { useMatomo } from '@datapunt/matomo-tracker-react'
import Header from './Header'
import Head from 'next/head'
import Footer from './Footer'
import styles from './Main.module.scss'

const Main: FunctionComponent = ({ children }) => {
  const { trackPageView } = useMatomo()

  // Track page view
  useEffect(() => {
    trackPageView({})
  }, [trackPageView])

  return (
    <div id={styles.wrapper}>
      <Head>
        <base href='/' />

        <link rel='icon' type='image/png' href='./favicon.png' />
      </Head>
      <Header />

      <main className={styles.main}>{children}</main>

      <Footer />
    </div>
  )
}

export default Main
