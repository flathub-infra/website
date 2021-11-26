import Head from 'next/head'
import { FunctionComponent, useEffect } from 'react'

import Footer from './Footer'
import Header from './Header'
import { useMatomo } from '@datapunt/matomo-tracker-react'
import styles from './PageContent.module.scss'

const PageContent: FunctionComponent = ({ children }) => {
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

export default PageContent
